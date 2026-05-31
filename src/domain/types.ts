export type WalletState = "disconnected" | "connecting" | "connected";

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
  | "active"
  | "paused"
  | "revoked";

export interface PolicyDraft {
  id: string;
  strategy: string;
  spendPerExecution: string;
  frequency: string;
  monthlyCap: string;
  allowedAssets: string;
  slippageLimit: string;
  minimumReserve: string;
  expiry: string;
  agentPermission: string;
  status: PolicyStatus;
  contractAddress: string;
}

export type ActivityKind = "executed" | "blocked" | "pending" | "review-needed";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  attempted: string;
  reason: string;
  rule: string;
  fundsMoved: string;
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
