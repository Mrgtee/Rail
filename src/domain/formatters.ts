import { assetTicker } from "./assets";
import type { PolicyDraft } from "./types";

export function formatUSDC(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}

export function formatAssetAmount(value: number, asset: string) {
  const decimals = asset === "ETH" ? 6 : 2;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${assetTicker(asset)}`;
}

export function formatSlippage(bps: number) {
  return `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function intervalLabel(policy: Pick<PolicyDraft, "intervalValue" | "intervalUnit" | "frequency">) {
  if (policy.intervalValue > 0 && policy.intervalUnit) {
    const unit = policy.intervalValue === 1 ? policy.intervalUnit.replace(/s$/, "") : policy.intervalUnit;
    return `Every ${policy.intervalValue} ${unit}`;
  }

  return policy.frequency;
}

export function policyRoute(policy: PolicyDraft) {
  return `${assetTicker(policy.inputAsset)} -> ${assetTicker(policy.outputAsset)}`;
}

export function policyFields(policy: PolicyDraft) {
  return [
    { label: "Strategy", value: policy.strategy },
    { label: "Spend", value: formatAssetAmount(policy.spendPerExecutionUSDC, policy.inputAsset) },
    { label: "Cadence", value: intervalLabel(policy) },
    { label: "Period cap", value: formatAssetAmount(policy.monthlyCapUSDC, policy.inputAsset) },
    { label: "Allowed pair", value: policyRoute(policy) },
    { label: "Slippage limit", value: formatSlippage(policy.slippageBps) },
    { label: "Minimum reserve", value: formatAssetAmount(policy.minimumReserveUSDC, policy.inputAsset) },
    { label: "Expiry", value: `${policy.expiryDays} days` },
    { label: "Agent permission", value: policy.agentPermission },
  ];
}

export function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";
}
