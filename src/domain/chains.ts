import type { SupportedChain } from "./types";

export const ROBINHOOD_CHAIN_TESTNET = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  role: "primary",
  nativeCurrency: "ETH",
  explorerUrl: "https://explorer.testnet.chain.robinhood.com",
  rpcEnvKey: "VITE_ROBINHOOD_RPC_URL",
} as const satisfies SupportedChain;

export const ARBITRUM_SEPOLIA = {
  id: 421614,
  name: "Arbitrum Sepolia",
  role: "secondary",
  nativeCurrency: "ETH",
  explorerUrl: "https://sepolia.arbiscan.io",
  rpcEnvKey: "VITE_ARBITRUM_SEPOLIA_RPC_URL",
} as const satisfies SupportedChain;

export const supportedChains = [ROBINHOOD_CHAIN_TESTNET, ARBITRUM_SEPOLIA] as const;
export const primaryChain = ROBINHOOD_CHAIN_TESTNET;

export function getSupportedChainName(chainId?: number) {
  return supportedChains.find((chain) => chain.id === chainId)?.name ?? "Unsupported network";
}
