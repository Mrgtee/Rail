import OpenAI from "openai";
import type { PolicyDraftRequest, RailPolicy } from "./schemas.js";

const now = () => new Date().toISOString();

function readNumber(patterns: RegExp[], text: string, fallback: number) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match.slice(1).find(Boolean);
      if (value) {
        return Number(value);
      }
    }
  }

  return fallback;
}

export function deterministicPolicyDraft(request: PolicyDraftRequest): RailPolicy {
  const goal = request.goal.toLowerCase();
  const spend = readNumber([/(\d+(?:\.\d+)?)\s*usdc/, /spend\s+(\d+(?:\.\d+)?)/], goal, 20);
  const reserve = readNumber([/keep\s+(\d+(?:\.\d+)?)\s*usdc/, /reserve\s+(\d+(?:\.\d+)?)\s*usdc/], goal, 50);
  const slippagePercent = readNumber([/(\d+(?:\.\d+)?)%\s*slippage/, /slippage\s*(?:above|over|at)?\s*(\d+(?:\.\d+)?)%/], goal, 1);
  const frequency = goal.includes("daily") ? "Daily" : goal.includes("month") ? "Monthly" : "Weekly";
  const outputAsset = goal.includes("arb") ? "ARB" : "ETH";
  const createdAt = now();

  return {
    id: `rail-policy-${Date.now()}`,
    ownerAddress: request.walletAddress,
    chainId: request.chainId === 421614 ? 421614 : 46630,
    strategy: "DCA",
    inputAsset: "USDC",
    outputAsset,
    allowedAssets: ["USDC", outputAsset],
    spendPerExecutionUSDC: spend,
    frequency,
    monthlyCapUSDC: Math.max(spend * 5, 100),
    slippageBps: Math.round(slippagePercent * 100),
    minimumReserveUSDC: reserve,
    expiryDays: 90,
    agentPermission: "Execute only",
    status: "awaiting-signature",
    contractAddress: process.env.POLICY_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000",
    createdAt,
    updatedAt: createdAt,
    warnings: ["AI drafts only. User signature is required before activation.", "Agent execution must pass PolicyVault checks."],
    summary: `DCA ${spend} USDC into ${outputAsset} on a ${frequency.toLowerCase()} cadence with ${slippagePercent}% max slippage.`,
  };
}

export async function draftPolicy(request: PolicyDraftRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return { policy: deterministicPolicyDraft(request), provider: "deterministic-fallback" as const };
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await (client.responses as any).create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: "Extract a conservative Rail policy. Return only valid JSON matching the requested schema." },
        { role: "user", content: request.goal },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "rail_policy_extract",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["spendPerExecutionUSDC", "frequency", "monthlyCapUSDC", "slippageBps", "minimumReserveUSDC", "outputAsset"],
            properties: {
              spendPerExecutionUSDC: { type: "number" },
              frequency: { type: "string", enum: ["Daily", "Weekly", "Monthly"] },
              monthlyCapUSDC: { type: "number" },
              slippageBps: { type: "number" },
              minimumReserveUSDC: { type: "number" },
              outputAsset: { type: "string" },
            },
          },
        },
      },
    });

    const raw = response.output_text ? JSON.parse(response.output_text) : {};
    const fallback = deterministicPolicyDraft(request);

    return {
      policy: {
        ...fallback,
        ...raw,
        allowedAssets: ["USDC", raw.outputAsset || fallback.outputAsset],
        updatedAt: now(),
      },
      provider: "openai-responses" as const,
    };
  } catch (error) {
    return {
      policy: deterministicPolicyDraft(request),
      provider: "deterministic-fallback" as const,
      warning: error instanceof Error ? error.message : "OpenAI policy drafting failed",
    };
  }
}
