import OpenAI from "openai";
import type { PolicyDraftRequest, RailPolicy } from "./schemas.js";

const now = () => new Date().toISOString();

function hasNumber(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

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

function parseInterval(goal: string) {
  const match = goal.match(/every\s+(?:(\d+(?:\.\d+)?)\s*)?(sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|day|days|week|weeks|year|years)/);
  const rawUnit = match?.[2];
  const intervalValue = Math.max(1, Math.floor(Number(match?.[1] ?? 1)));

  if (!rawUnit) {
    if (goal.includes("daily")) return { intervalValue: 1, intervalUnit: "days" as const, frequency: "Daily" as const };
    if (goal.includes("month")) return { intervalValue: 30, intervalUnit: "days" as const, frequency: "Monthly" as const };
    return { intervalValue: 1, intervalUnit: "weeks" as const, frequency: "Weekly" as const };
  }

  const intervalUnit = rawUnit.startsWith("sec") ? "seconds" : rawUnit.startsWith("min") ? "minutes" : rawUnit.startsWith("hour") ? "hours" : rawUnit.startsWith("day") ? "days" : rawUnit.startsWith("week") ? "weeks" : "years";
  const frequency = intervalUnit === "days" ? "Daily" : intervalUnit === "years" ? "Monthly" : "Weekly";
  return { intervalValue, intervalUnit, frequency } as const;
}

function detectOutputAsset(goal: string) {
  if (goal.includes("into usdc") || goal.includes("to usdc")) return "USDC";
  return "ETH";
}

export function deterministicPolicyDraft(request: PolicyDraftRequest): RailPolicy {
  const goal = request.goal.toLowerCase();
  const spend = readNumber([/(\d+(?:\.\d+)?)\s*(?:usdc|eth|weth)/, /spend\s+(\d+(?:\.\d+)?)/], goal, 20);
  const reservePatterns = [/keep\s+(\d+(?:\.\d+)?)\s*(?:usdc|eth|weth)/, /reserve\s+(\d+(?:\.\d+)?)\s*(?:usdc|eth|weth)/];
  const reserve = readNumber(reservePatterns, goal, 0);
  const slippagePercent = readNumber([/(\d+(?:\.\d+)?)%\s*slippage/, /slippage\s*(?:above|over|at)?\s*(\d+(?:\.\d+)?)%/], goal, 1);
  const interval = parseInterval(goal);
  const outputAsset = detectOutputAsset(goal);
  const inputAsset = outputAsset === "USDC" ? "ETH" : "USDC";
  const createdAt = now();

  return {
    id: `rail-policy-${Date.now()}`,
    ownerAddress: request.walletAddress,
    chainId: request.chainId === 421614 ? 421614 : 46630,
    strategy: "DCA",
    inputAsset,
    outputAsset,
    allowedAssets: [inputAsset, outputAsset],
    spendPerExecutionUSDC: spend,
    frequency: interval.frequency,
    intervalValue: interval.intervalValue,
    intervalUnit: interval.intervalUnit,
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
    summary: `DCA ${spend} ${inputAsset} into ${outputAsset} every ${interval.intervalValue} ${interval.intervalUnit} with ${slippagePercent}% max slippage${reserve > 0 ? ` and ${reserve} ${inputAsset} reserve` : ""}.`,
  };
}

export async function draftPolicy(request: PolicyDraftRequest) {
  const fallback = deterministicPolicyDraft(request);
  if (!process.env.OPENAI_API_KEY) {
    return { policy: fallback, provider: "deterministic-fallback" as const };
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await (client.responses as any).create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: "Extract a Rail policy. Return only valid JSON matching the requested schema. Supported assets are USDC and ETH. Do not invent a minimum reserve: if the user did not explicitly say keep/reserve a token amount, set minimumReserveUSDC to 0." },
        { role: "user", content: request.goal },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "rail_policy_extract",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["spendPerExecutionUSDC", "monthlyCapUSDC", "slippageBps", "minimumReserveUSDC", "inputAsset", "outputAsset", "intervalValue", "intervalUnit"],
            properties: {
              spendPerExecutionUSDC: { type: "number" },
              monthlyCapUSDC: { type: "number" },
              slippageBps: { type: "number" },
              minimumReserveUSDC: { type: "number" },
              inputAsset: { type: "string", enum: ["USDC", "ETH"] },
              outputAsset: { type: "string", enum: ["USDC", "ETH"] },
              intervalValue: { type: "number" },
              intervalUnit: { type: "string", enum: ["seconds", "minutes", "hours", "days", "weeks", "years"] },
            },
          },
        },
      },
    });

    const raw = response.output_text ? JSON.parse(response.output_text) : {};
    const inputAsset = raw.inputAsset && raw.inputAsset !== raw.outputAsset ? raw.inputAsset : fallback.inputAsset;
    const outputAsset = raw.outputAsset && raw.outputAsset !== inputAsset ? raw.outputAsset : fallback.outputAsset;
    const reserveWasExplicit = hasNumber([/keep\s+(\d+(?:\.\d+)?)\s*(?:usdc|eth|weth)/, /reserve\s+(\d+(?:\.\d+)?)\s*(?:usdc|eth|weth)/], request.goal.toLowerCase());
    const intervalUnit = raw.intervalUnit || fallback.intervalUnit;
    const frequency = intervalUnit === "days" ? "Daily" : intervalUnit === "years" ? "Monthly" : "Weekly";

    return {
      policy: {
        ...fallback,
        ...raw,
        inputAsset,
        outputAsset,
        allowedAssets: [inputAsset, outputAsset],
        intervalValue: Math.max(1, Math.floor(Number(raw.intervalValue || fallback.intervalValue))),
        intervalUnit,
        minimumReserveUSDC: reserveWasExplicit ? Math.max(0, Number(raw.minimumReserveUSDC ?? fallback.minimumReserveUSDC)) : 0,
        frequency,
        updatedAt: now(),
      },
      provider: "openai-responses" as const,
    };
  } catch (error) {
    return {
      policy: fallback,
      provider: "deterministic-fallback" as const,
      warning: error instanceof Error ? error.message : "OpenAI policy drafting failed",
    };
  }
}
