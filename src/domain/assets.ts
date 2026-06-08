export const supportedSwapAssets = ["USDC", "ETH"] as const;

export type SwapAsset = (typeof supportedSwapAssets)[number];

export function isSupportedSwapAsset(value: string): value is SwapAsset {
  return supportedSwapAssets.includes(value as SwapAsset);
}

export function pairedSwapAsset(asset: string): SwapAsset {
  return asset === "ETH" ? "USDC" : "ETH";
}

export function displayAsset(asset: string) {
  return asset === "ETH" ? "rWETH" : "rUSDC";
}

export function assetTicker(asset: string) {
  return asset === "ETH" ? "WETH" : "USDC";
}
