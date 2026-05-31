import type { ActivityEvent, ActivationStep, PolicyDraft } from "./types";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const defaultGoal =
  "DCA 20 USDC into ETH every week. Keep 50 USDC liquid. Stop if slippage is above 1%.";

export const draftingSteps = [
  "Reading goal",
  "Detecting strategy",
  "Setting limits",
  "Checking supported assets",
  "Preparing policy",
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

export const samplePolicy: PolicyDraft = {
  id: "rail-policy-001",
  strategy: "DCA",
  spendPerExecution: "20 USDC",
  frequency: "Weekly",
  monthlyCap: "100 USDC",
  allowedAssets: "USDC -> ETH",
  slippageLimit: "1%",
  minimumReserve: "50 USDC",
  expiry: "90 days",
  agentPermission: "Execute only",
  status: "awaiting-signature",
  contractAddress: "0x7a91...B04f",
};

export const dashboardEvents: ActivityEvent[] = [
  {
    id: "evt-blocked-slippage",
    kind: "blocked",
    title: "Blocked: slippage above 1%",
    attempted: "Swap 20 USDC -> ETH at 1.7% slippage",
    reason: "Quoted route exceeded your signed slippage limit.",
    rule: "Max slippage per execution",
    fundsMoved: "0 USDC",
    timestamp: "2 min ago",
  },
  {
    id: "evt-executed-dca",
    kind: "executed",
    title: "Executed weekly DCA",
    attempted: "Swap 20 USDC -> ETH",
    reason: "Action matched the active policy.",
    rule: "Weekly DCA within spend limit",
    fundsMoved: "20 USDC",
    txHash: "0xa49c...91e2",
    timestamp: "1 hr ago",
  },
  {
    id: "evt-review-reserve",
    kind: "review-needed",
    title: "Reserve close to limit",
    attempted: "Schedule next DCA",
    reason: "Vault reserve is approaching the 50 USDC minimum.",
    rule: "Minimum reserve",
    fundsMoved: "Pending",
    timestamp: "Tomorrow",
  },
];

export async function generatePolicy(goalText: string): Promise<PolicyDraft> {
  await wait(650);

  return {
    ...samplePolicy,
    id: goalText.length > 0 ? "rail-policy-dca-demo" : samplePolicy.id,
  };
}

export async function signPolicy(policy: PolicyDraft): Promise<PolicyDraft> {
  await wait(700);

  return {
    ...policy,
    status: "active",
  };
}

export async function activatePolicy(policy: PolicyDraft): Promise<PolicyDraft> {
  await wait(700);

  return {
    ...policy,
    status: "active",
  };
}

export function simulateAgentActivity(): ActivityEvent[] {
  return dashboardEvents;
}
