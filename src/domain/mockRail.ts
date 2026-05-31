import { primaryChain } from "./chains";
import type { ActivityEvent, ActivationStep, PolicyDraft, UserAccount } from "./types";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const defaultGoal =
  "DCA 20 USDC into ETH every week. Keep 50 USDC liquid. Stop if slippage is above 1%.";

export const draftingSteps = [
  "Reading goal",
  "Detecting strategy",
  "Setting spend and reserve limits",
  "Checking supported assets",
  "Preparing policy JSON",
];

export const activationSteps: ActivationStep[] = [
  {
    key: "signature",
    label: "Awaiting signature",
    detail: "Wallet approval confirms the rails.",
  },
  {
    key: "creating",
    label: "Creating policy",
    detail: "PolicyVault receives signed limits.",
  },
  {
    key: "confirming",
    label: "Confirming onchain",
    detail: "Testnet block confirms enforcement.",
  },
  {
    key: "active",
    label: "Policy active",
    detail: "Agent can execute only inside these rails.",
  },
];

export const disconnectedAccount: UserAccount = {
  status: "disconnected",
  vaultBalanceUSDC: 0,
  sessionKeyStatus: "inactive",
};

export const demoAccount: UserAccount = {
  status: "connected",
  address: "0x8A12F3E9B4c5A7d02f915E061aC2eC6e84493410",
  smartAccountAddress: "0x4E7A8bD7bF2C8a4a8dE6F2e84B7346b51A9F01B2",
  chainId: primaryChain.id,
  chainName: primaryChain.name,
  ethBalance: 1.42,
  vaultBalanceUSDC: 142.8,
  sessionKeyStatus: "active",
};

export const wrongNetworkAccount: UserAccount = {
  ...demoAccount,
  status: "wrong-network",
  chainId: 1,
  chainName: "Ethereum Mainnet",
  error: `Switch to ${primaryChain.name} to create Rail policies.`,
};

const now = new Date("2026-05-31T09:00:00.000Z").toISOString();

export const samplePolicy: PolicyDraft = {
  id: "rail-policy-001",
  ownerAddress: demoAccount.address,
  chainId: primaryChain.id,
  strategy: "DCA",
  inputAsset: "USDC",
  outputAsset: "ETH",
  allowedAssets: ["USDC", "ETH"],
  spendPerExecutionUSDC: 20,
  frequency: "Weekly",
  monthlyCapUSDC: 100,
  slippageBps: 100,
  minimumReserveUSDC: 50,
  expiryDays: 90,
  agentPermission: "Execute only",
  status: "awaiting-signature",
  contractAddress: "0x7a91...B04f",
  createdAt: now,
  updatedAt: now,
  warnings: ["The agent can execute only through PolicyVault checks."],
  summary: "Weekly DCA guardrails for swapping USDC into ETH while preserving a 50 USDC reserve.",
};

export const dashboardEvents: ActivityEvent[] = [
  {
    id: "evt-blocked-slippage",
    policyId: samplePolicy.id,
    kind: "blocked",
    status: "blocked",
    actionType: "dca-swap",
    title: "Blocked: slippage above 1%",
    attempted: "Swap 20 USDC -> ETH at 1.7% slippage",
    reason: "Quoted route exceeded your signed slippage limit.",
    rule: "Max slippage per execution",
    fundsMoved: "0 USDC",
    simulationResult: "blocked",
    transaction: { chainId: primaryChain.id, status: "not-submitted", contractAddress: samplePolicy.contractAddress },
    createdAt: new Date("2026-05-31T08:58:00.000Z").toISOString(),
    timestamp: "2 min ago",
  },
  {
    id: "evt-executed-dca",
    policyId: samplePolicy.id,
    kind: "executed",
    status: "executed",
    actionType: "dca-swap",
    title: "Executed weekly DCA",
    attempted: "Swap 20 USDC -> ETH",
    reason: "Action matched the active policy.",
    rule: "Weekly DCA within spend limit",
    fundsMoved: "20 USDC",
    simulationResult: "passed",
    transaction: { chainId: primaryChain.id, status: "confirmed", hash: "0xa49c...91e2", contractAddress: samplePolicy.contractAddress },
    txHash: "0xa49c...91e2",
    createdAt: new Date("2026-05-31T08:00:00.000Z").toISOString(),
    timestamp: "1 hr ago",
  },
  {
    id: "evt-review-reserve",
    policyId: samplePolicy.id,
    kind: "review-needed",
    status: "review-needed",
    actionType: "dca-swap",
    title: "Reserve close to limit",
    attempted: "Schedule next DCA",
    reason: "Vault reserve is approaching the 50 USDC minimum.",
    rule: "Minimum reserve",
    fundsMoved: "Pending",
    simulationResult: "needs-review",
    transaction: { chainId: primaryChain.id, status: "not-submitted", contractAddress: samplePolicy.contractAddress },
    createdAt: new Date("2026-06-01T09:00:00.000Z").toISOString(),
    timestamp: "Tomorrow",
  },
];

export async function generatePolicy(goalText: string, ownerAddress?: string): Promise<PolicyDraft> {
  await wait(650);

  const lowerGoal = goalText.toLowerCase();
  const spendMatch = lowerGoal.match(/(\d+(?:\.\d+)?)\s*usdc/);
  const reserveMatch = lowerGoal.match(/keep\s+(\d+(?:\.\d+)?)\s*usdc|reserve\s+(\d+(?:\.\d+)?)\s*usdc/);
  const slippageMatch = lowerGoal.match(/(\d+(?:\.\d+)?)%\s*slippage|slippage\s*(?:is\s*)?(?:above\s*)?(\d+(?:\.\d+)?)%/);

  const spend = spendMatch ? Number(spendMatch[1]) : samplePolicy.spendPerExecutionUSDC;
  const reserve = reserveMatch ? Number(reserveMatch[1] ?? reserveMatch[2]) : samplePolicy.minimumReserveUSDC;
  const slippage = slippageMatch ? Number(slippageMatch[1] ?? slippageMatch[2]) * 100 : samplePolicy.slippageBps;
  const frequency = lowerGoal.includes("daily") ? "Daily" : lowerGoal.includes("month") ? "Monthly" : "Weekly";

  return {
    ...samplePolicy,
    id: goalText.length > 0 ? "rail-policy-dca-demo" : samplePolicy.id,
    ownerAddress,
    spendPerExecutionUSDC: spend,
    minimumReserveUSDC: reserve,
    slippageBps: slippage,
    frequency,
    monthlyCapUSDC: Math.max(spend * 5, samplePolicy.monthlyCapUSDC),
    status: "awaiting-signature",
    updatedAt: new Date().toISOString(),
  };
}

export async function signPolicy(policy: PolicyDraft): Promise<PolicyDraft> {
  await wait(700);

  return {
    ...policy,
    status: "transaction-pending",
    updatedAt: new Date().toISOString(),
  };
}

export async function activatePolicy(policy: PolicyDraft): Promise<PolicyDraft> {
  await wait(700);

  return {
    ...policy,
    status: "active",
    updatedAt: new Date().toISOString(),
  };
}

export function simulateAgentActivity(): ActivityEvent[] {
  return dashboardEvents;
}

export function createLocalActivity(partial: Pick<ActivityEvent, "kind" | "title" | "attempted" | "reason" | "rule" | "fundsMoved"> & Partial<ActivityEvent>): ActivityEvent {
  const createdAt = new Date().toISOString();

  return {
    id: `evt-${Date.now()}`,
    policyId: partial.policyId ?? samplePolicy.id,
    status: partial.kind,
    actionType: partial.actionType ?? "policy-update",
    simulationResult: partial.simulationResult ?? (partial.kind === "blocked" ? "blocked" : "passed"),
    transaction: partial.transaction ?? { chainId: primaryChain.id, status: "not-submitted" },
    createdAt,
    timestamp: "Just now",
    ...partial,
  };
}
