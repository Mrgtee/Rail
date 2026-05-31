import { z } from "zod";

export const supportedAssets = ["USDC", "ETH", "ARB"] as const;

export const policyDraftRequestSchema = z.object({
  walletAddress: z.string().optional(),
  chainId: z.number().default(46630),
  goal: z.string().min(8),
  supportedAssets: z.array(z.string()).default([...supportedAssets]),
});

export const policySchema = z.object({
  id: z.string(),
  ownerAddress: z.string().optional(),
  chainId: z.union([z.literal(46630), z.literal(421614)]),
  strategy: z.enum(["DCA", "Rebalance", "Stable parking"]),
  inputAsset: z.string(),
  outputAsset: z.string(),
  allowedAssets: z.array(z.string()).min(1),
  spendPerExecutionUSDC: z.number().positive(),
  frequency: z.enum(["Daily", "Weekly", "Monthly"]),
  monthlyCapUSDC: z.number().positive(),
  slippageBps: z.number().int().min(1).max(500),
  minimumReserveUSDC: z.number().min(0),
  expiryDays: z.number().int().min(1).max(365),
  agentPermission: z.enum(["Execute only", "Simulation only"]),
  status: z.enum(["draft", "awaiting-signature", "transaction-pending", "active", "paused", "revoked", "expired", "failed"]),
  contractAddress: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  warnings: z.array(z.string()),
  summary: z.string(),
});

export const validatePolicyRequestSchema = z.object({
  policy: policySchema,
});

export const agentActionRequestSchema = z.object({
  walletAddress: z.string().optional(),
  policy: policySchema,
  action: z.object({
    type: z.enum(["dca-swap", "pause", "deposit", "withdraw", "policy-update"]).default("dca-swap"),
    inputAsset: z.string().default("USDC"),
    outputAsset: z.string().default("ETH"),
    amountUSDC: z.number().positive().default(20),
    slippageBps: z.number().int().min(0).default(100),
    projectedReserveUSDC: z.number().min(0).default(100),
  }),
});

export type PolicyDraftRequest = z.infer<typeof policyDraftRequestSchema>;
export type AgentActionRequest = z.infer<typeof agentActionRequestSchema>;
export type RailPolicy = z.infer<typeof policySchema>;
