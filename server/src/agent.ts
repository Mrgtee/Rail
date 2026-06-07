import type { AgentActionRequest } from "./schemas.js";

export function validatePolicy(policy: AgentActionRequest["policy"]) {
  const errors: string[] = [];

  if (policy.status !== "awaiting-signature" && policy.status !== "active") {
    errors.push(`Policy status ${policy.status} cannot execute.`);
  }
  if (policy.spendPerExecutionUSDC <= 0) {
    errors.push("Spend limit must be greater than zero.");
  }
  if (policy.monthlyCapUSDC < policy.spendPerExecutionUSDC) {
    errors.push("Period cap must be at least one execution spend.");
  }
  if (policy.intervalValue <= 0) {
    errors.push("Execution interval must be greater than zero.");
  }
  if (policy.slippageBps > 500) {
    errors.push("Slippage cannot exceed 5% in the MVP.");
  }
  if (!policy.allowedAssets.includes(policy.inputAsset) || !policy.allowedAssets.includes(policy.outputAsset)) {
    errors.push("Input and output assets must be explicitly allowed.");
  }
  if (policy.inputAsset === policy.outputAsset) {
    errors.push("Input and output assets must be different.");
  }

  return { ok: errors.length === 0, errors };
}

export function simulateAction(request: AgentActionRequest) {
  const { action, policy } = request;
  const base = {
    policyId: policy.id,
    actionType: action.type,
    attempted: `${action.type}: ${action.amountUSDC} ${action.inputAsset} -> ${action.outputAsset}`,
  };

  if (policy.status !== "active" && policy.status !== "awaiting-signature") {
    return { executable: false, reason: `Policy is ${policy.status}.`, rule: "Active policy status", ...base };
  }
  if (action.inputAsset !== policy.inputAsset || action.outputAsset !== policy.outputAsset) {
    return { executable: false, reason: "Action pair does not match the signed policy pair.", rule: "Signed asset pair", ...base };
  }
  if (!policy.allowedAssets.includes(action.inputAsset) || !policy.allowedAssets.includes(action.outputAsset)) {
    return { executable: false, reason: "Action uses an asset outside the signed allowlist.", rule: "Allowed assets", ...base };
  }
  if (action.amountUSDC > policy.spendPerExecutionUSDC) {
    return { executable: false, reason: "Action exceeds spend per execution.", rule: "Max spend per execution", ...base };
  }
  if (action.slippageBps > policy.slippageBps) {
    return { executable: false, reason: "Route exceeds signed slippage limit.", rule: "Max slippage", ...base };
  }
  if (action.projectedReserveUSDC < policy.minimumReserveUSDC) {
    return { executable: false, reason: "Action would violate the minimum reserve.", rule: "Minimum reserve", ...base };
  }

  return { executable: true, reason: "Action matches the active policy.", rule: "PolicyVault checks", ...base };
}
