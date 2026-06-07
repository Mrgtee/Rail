export type SupportedChainId = 46630 | 421614;

export interface SupportedChain {
  id: SupportedChainId;
  name: string;
  role: "primary" | "secondary";
  nativeCurrency: string;
  explorerUrl: string;
  rpcEnvKey: string;
}

export type WalletStatus = "disconnected" | "connecting" | "connected" | "wrong-network";
export type WalletState = WalletStatus;

export interface UserAccount {
  status: WalletStatus;
  address?: string;
  smartAccountAddress?: string;
  chainId?: number;
  chainName?: string;
  ethBalance?: number;
  vaultBalanceUSDC: number;
  vaultBalanceWETH: number;
  sessionKeyStatus: "inactive" | "active" | "expired";
  error?: string;
}

export type AppStage =
  | "landing"
  | "connect"
  | "goal"
  | "drafting"
  | "review"
  | "activating"
  | "dashboard";

export type PolicyStatus =
  | "draft"
  | "awaiting-signature"
  | "transaction-pending"
  | "active"
  | "paused"
  | "revoked"
  | "expired"
  | "failed";

export type StrategyType = "DCA" | "Rebalance" | "Stable parking";
export type Frequency = "Daily" | "Weekly" | "Monthly";
export type IntervalUnit = "seconds" | "minutes" | "hours" | "days" | "weeks" | "years";

export interface PolicyDraft {
  id: string;
  ownerAddress?: string;
  chainId: SupportedChainId;
  strategy: StrategyType;
  inputAsset: string;
  outputAsset: string;
  allowedAssets: string[];
  spendPerExecutionUSDC: number;
  frequency: Frequency;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  monthlyCapUSDC: number;
  slippageBps: number;
  minimumReserveUSDC: number;
  expiryDays: number;
  agentPermission: "Execute only" | "Simulation only";
  status: PolicyStatus;
  contractAddress: string;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
  summary: string;
}

export type ActivityKind = "executed" | "blocked" | "pending" | "review-needed" | "failed";

export interface TransactionRecord {
  hash?: string;
  chainId: SupportedChainId;
  contractAddress?: string;
  status: "not-submitted" | "pending" | "confirmed" | "failed";
}

export interface AgentAction {
  id: string;
  policyId: string;
  status: ActivityKind;
  actionType: "dca-swap" | "pause" | "deposit" | "withdraw" | "policy-update";
  attempted: string;
  rule: string;
  reason: string;
  fundsMoved: string;
  simulationResult: "passed" | "blocked" | "needs-review" | "failed";
  transaction: TransactionRecord;
  createdAt: string;
}

export interface ActivityEvent extends AgentAction {
  kind: ActivityKind;
  title: string;
  timestamp: string;
  txHash?: string;
}

export type ActivationStepKey =
  | "signature"
  | "creating"
  | "confirming"
  | "active";

export interface ActivationStep {
  key: ActivationStepKey;
  label: string;
  detail: string;
}
