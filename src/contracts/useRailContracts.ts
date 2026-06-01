import { useCallback } from "react";
import { parseUnits, zeroAddress, type Address } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { erc20Abi } from "./abis";
import { contractAddresses, contractsConfigured } from "./addresses";
import { policyVaultAbi } from "./generated";
import type { PolicyDraft, UserAccount } from "../domain/types";

function asAddress(value: string | undefined): Address {
  return (value && value.startsWith("0x") ? value : zeroAddress) as Address;
}

function cooldownSeconds(policy: PolicyDraft) {
  if (policy.frequency === "Daily") return 86_400;
  if (policy.frequency === "Monthly") return 2_592_000;
  return 604_800;
}

export function useRailContracts(account: UserAccount) {
  const { writeContractAsync, isPending } = useWriteContract();
  const owner = asAddress(account.address);
  const usdc = asAddress(contractAddresses.mockUSDC);
  const outputAsset = asAddress(contractAddresses.mockWETH || contractAddresses.mockUSDC);
  const policyVault = asAddress(contractAddresses.policyVault);

  const { data: tokenBalance } = useReadContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
    query: { enabled: contractsConfigured && account.status === "connected" && owner !== zeroAddress && usdc !== zeroAddress },
  });

  const { data: vaultBalance } = useReadContract({
    address: policyVault,
    abi: policyVaultAbi,
    functionName: "vaultBalanceOf",
    args: [owner, usdc],
    query: { enabled: contractsConfigured && account.status === "connected" && owner !== zeroAddress && policyVault !== zeroAddress && usdc !== zeroAddress },
  });

  const createPolicy = useCallback(async (policy: PolicyDraft) => {
    if (!contractsConfigured) {
      throw new Error("Rail contracts are not configured.");
    }

    const now = Math.floor(Date.now() / 1000);
    const hash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "createPolicy",
      args: [
        {
          inputAsset: usdc,
          outputAsset,
          spendLimit: parseUnits(String(policy.spendPerExecutionUSDC), 6),
          monthlyCap: parseUnits(String(policy.monthlyCapUSDC), 6),
          slippageBps: policy.slippageBps,
          minimumReserve: parseUnits(String(policy.minimumReserveUSDC), 6),
          cooldownSeconds: cooldownSeconds(policy),
          expiresAt: BigInt(now + policy.expiryDays * 86_400),
          agent: asAddress(contractAddresses.agentExecutor),
        },
      ],
    });

    return hash;
  }, [outputAsset, policyVault, usdc, writeContractAsync]);

  return {
    canWriteContracts: contractsConfigured && account.status === "connected",
    createPolicy,
    isWriting: isPending,
    tokenBalanceUSDC: typeof tokenBalance === "bigint" ? Number(tokenBalance) / 1e6 : undefined,
    vaultBalanceUSDC: typeof vaultBalance === "bigint" ? Number(vaultBalance) / 1e6 : undefined,
  };
}
