import type { PolicyDraft } from "./types";

export function formatUSDC(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}

export function formatSlippage(bps: number) {
  return `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function policyRoute(policy: PolicyDraft) {
  return `${policy.inputAsset} -> ${policy.outputAsset}`;
}

export function policyFields(policy: PolicyDraft) {
  return [
    { label: "Strategy", value: policy.strategy },
    { label: "Spend", value: formatUSDC(policy.spendPerExecutionUSDC) },
    { label: "Frequency", value: policy.frequency },
    { label: "Monthly cap", value: formatUSDC(policy.monthlyCapUSDC) },
    { label: "Allowed assets", value: policyRoute(policy) },
    { label: "Slippage limit", value: formatSlippage(policy.slippageBps) },
    { label: "Minimum reserve", value: formatUSDC(policy.minimumReserveUSDC) },
    { label: "Expiry", value: `${policy.expiryDays} days` },
    { label: "Agent permission", value: policy.agentPermission },
  ];
}

export function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";
}
