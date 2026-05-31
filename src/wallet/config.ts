import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arbitrumSepoliaRpcUrl, railArbitrumSepolia, railChains, robinhoodChain, robinhoodRpcUrl } from "./chains";

export const wagmiConfig = createConfig({
  chains: railChains,
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [robinhoodChain.id]: http(robinhoodRpcUrl),
    [railArbitrumSepolia.id]: http(arbitrumSepoliaRpcUrl),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
