import { defineChain } from "viem";
import { arbitrumSepolia as viemArbitrumSepolia } from "viem/chains";
import { ARBITRUM_SEPOLIA_PUBLIC_RPC_URL, ROBINHOOD_PUBLIC_RPC_URL } from "../domain/chains";

export const robinhoodRpcUrl = import.meta.env.VITE_ROBINHOOD_RPC_URL || ROBINHOOD_PUBLIC_RPC_URL;
export const arbitrumSepoliaRpcUrl = import.meta.env.VITE_ARBITRUM_SEPOLIA_RPC_URL || ARBITRUM_SEPOLIA_PUBLIC_RPC_URL;

export const robinhoodChain = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [robinhoodRpcUrl] },
    public: { http: [ROBINHOOD_PUBLIC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

export const railArbitrumSepolia = {
  ...viemArbitrumSepolia,
  rpcUrls: {
    default: { http: [arbitrumSepoliaRpcUrl] },
    public: { http: [ARBITRUM_SEPOLIA_PUBLIC_RPC_URL] },
  },
};

export const railChains = [robinhoodChain, railArbitrumSepolia] as const;
