import { formatEther } from "viem";
import { useAccount, useBalance, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { getSupportedChainName, isSupportedChain, primaryChain } from "../domain/chains";
import type { UserAccount } from "../domain/types";
import { robinhoodChain } from "./chains";

export function useRailWallet() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: balance } = useBalance({ address, query: { enabled: Boolean(address) } });

  const walletStatus: UserAccount["status"] = isPending || isSwitching
    ? "connecting"
    : isConnected && !isSupportedChain(chainId)
      ? "wrong-network"
      : isConnected
        ? "connected"
        : status === "connecting" || status === "reconnecting"
          ? "connecting"
          : "disconnected";

  const account: UserAccount = {
    status: walletStatus,
    address,
    chainId,
    chainName: getSupportedChainName(chainId),
    ethBalance: balance ? Number(formatEther(balance.value)) : undefined,
    vaultBalanceUSDC: 0,
    sessionKeyStatus: isConnected && walletStatus === "connected" ? "active" : "inactive",
    error: walletStatus === "wrong-network" ? `Switch to ${primaryChain.name} to create Rail policies.` : undefined,
  };

  const connect = async () => {
    const connector = connectors[0];

    if (!connector) {
      return false;
    }

    await connectAsync({ connector, chainId: robinhoodChain.id });
    return true;
  };

  const switchToPrimaryChain = async () => {
    await switchChainAsync({ chainId: robinhoodChain.id });
  };

  return {
    account,
    connect,
    disconnect,
    hasInjectedWallet: connectors.length > 0,
    switchToPrimaryChain,
  };
}
