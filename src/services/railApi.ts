import { generatePolicy } from "../domain/mockRail";
import type { ActivityEvent, PolicyDraft, UserAccount } from "../domain/types";

const apiBaseUrl = import.meta.env.VITE_RAIL_API_URL || "http://localhost:8787";

export type AgentDemoScenario = "valid" | "blocked-slippage" | "blocked-overspend";

export interface RailHealth {
  ok: boolean;
  service: string;
  openaiConfigured: boolean;
  robinhoodRpcConfigured: boolean;
  contractsConfigured: boolean;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Rail API ${path} failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function draftPolicyFromAgent(goal: string, account: UserAccount): Promise<{ policy: PolicyDraft; provider: string }> {
  try {
    const result = await postJson<{ ok: boolean; policy: PolicyDraft; provider: string }>("/api/policies/draft", {
      walletAddress: account.address,
      chainId: account.chainId ?? 46630,
      goal,
      supportedAssets: ["USDC", "ETH", "ARB"],
    });

    if (!result.ok) {
      throw new Error("Rail API returned a failed policy draft.");
    }

    return { policy: result.policy, provider: result.provider };
  } catch {
    return { policy: await generatePolicy(goal, account.address), provider: "frontend-fallback" };
  }
}

export async function simulateAgentAction(policy: PolicyDraft, account: UserAccount, overrides?: Partial<{ amountUSDC: number; slippageBps: number; projectedReserveUSDC: number }>) {
  return postJson<{ ok: boolean; status: "executable" | "blocked"; reason: string; rule: string; attempted: string }>("/api/agent/simulate", {
    walletAddress: account.address,
    policy,
    action: {
      type: "dca-swap",
      inputAsset: policy.inputAsset,
      outputAsset: policy.outputAsset,
      amountUSDC: overrides?.amountUSDC ?? policy.spendPerExecutionUSDC,
      slippageBps: overrides?.slippageBps ?? policy.slippageBps,
      projectedReserveUSDC: overrides?.projectedReserveUSDC ?? Math.max(0, account.vaultBalanceUSDC - policy.spendPerExecutionUSDC),
    },
  });
}

export async function executeAgentAction(policy: PolicyDraft, account: UserAccount, overrides?: Partial<{ amountUSDC: number; slippageBps: number; projectedReserveUSDC: number }>) {
  return postJson<{ ok: boolean; status: "executed" | "blocked"; activity: ActivityEvent; txHash?: string }>("/api/agent/execute", {
    walletAddress: account.address,
    policy,
    action: {
      type: "dca-swap",
      inputAsset: policy.inputAsset,
      outputAsset: policy.outputAsset,
      amountUSDC: overrides?.amountUSDC ?? policy.spendPerExecutionUSDC,
      slippageBps: overrides?.slippageBps ?? policy.slippageBps,
      projectedReserveUSDC: overrides?.projectedReserveUSDC ?? Math.max(0, account.vaultBalanceUSDC - policy.spendPerExecutionUSDC),
    },
  });
}

export async function fetchAgentActivity(walletAddress: string) {
  const response = await fetch(`${apiBaseUrl}/api/activity/${walletAddress}`);
  if (!response.ok) {
    throw new Error("Unable to load Rail activity.");
  }

  return response.json() as Promise<{ ok: boolean; activity: ActivityEvent[] }>;
}

export async function fetchRailHealth() {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  if (!response.ok) {
    throw new Error("Rail backend health check failed.");
  }

  return response.json() as Promise<RailHealth>;
}
