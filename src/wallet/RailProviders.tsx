import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import type { ReactNode } from "react";
import { wagmiConfig } from "./config";

const queryClient = new QueryClient();

interface RailProvidersProps {
  children: ReactNode;
}

export function RailProviders({ children }: RailProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
