import { useCallback } from "react";
import { decodeEventLog, formatUnits, parseUnits, zeroAddress, type Address, type Hash, type TransactionReceipt } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { contractAddresses, contractsConfigured } from "./addresses";
import { mockUSDCAbi, policyVaultAbi } from "./generated";
import type { IntervalUnit, PolicyDraft, UserAccount } from "../domain/types";

function asAddress(value: string | undefined): Address {
  return (value && value.startsWith("0x") ? value : zeroAddress) as Address;
}

function tokenForAsset(asset: string) {
  const normalized = asset.toUpperCase();
  if (normalized === "ETH" || normalized === "WETH") {
    return { address: asAddress(contractAddresses.mockWETH), decimals: 18, symbol: "ETH" };
  }
  return { address: asAddress(contractAddresses.mockUSDC), decimals: 6, symbol: "USDC" };
}

function secondsForUnit(unit: IntervalUnit) {
  if (unit === "seconds") return 1;
  if (unit === "minutes") return 60;
  if (unit === "hours") return 3_600;
  if (unit === "days") return 86_400;
  if (unit === "weeks") return 604_800;
  return 31_536_000;
}

function cooldownSeconds(policy: PolicyDraft) {
  if (policy.intervalValue > 0 && policy.intervalUnit) {
    return Math.min(4_294_967_295, Math.max(1, Math.floor(policy.intervalValue * secondsForUnit(policy.intervalUnit))));
  }
  if (policy.frequency === "Daily") return 86_400;
  if (policy.frequency === "Monthly") return 2_592_000;
  return 604_800;
}

function policyIdOf(policy: PolicyDraft) {
  if (!/^\d+$/.test(policy.id)) {
    throw new Error("This policy has not been created onchain yet.");
  }

  return BigInt(policy.id);
}

export interface OnchainPolicyResult {
  hash: Hash;
  policyId?: string;
}

export interface OnchainDepositResult {
  mintHash: Hash;
  approveHash: Hash;
  depositHash: Hash;
}

export function useRailContracts(account: UserAccount) {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const owner = asAddress(account.address);
  const usdc = tokenForAsset("USDC");
  const weth = tokenForAsset("ETH");
  const policyVault = asAddress(contractAddresses.policyVault);

  const waitForSuccess = useCallback(async (hash: Hash) => {
    if (!publicClient) {
      throw new Error("No public client is available for transaction confirmation.");
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Transaction failed onchain.");
    }

    return receipt;
  }, [publicClient]);

  const extractPolicyId = useCallback((receipt: TransactionReceipt) => {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== policyVault.toLowerCase()) continue;

      try {
        const decoded = decodeEventLog({ abi: policyVaultAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "PolicyCreated") {
          const args = decoded.args as { policyId?: bigint };
          return args.policyId?.toString();
        }
      } catch {
        // Ignore unrelated logs in the same receipt.
      }
    }

    return undefined;
  }, [policyVault]);

  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: usdc.address,
    abi: mockUSDCAbi,
    functionName: "balanceOf",
    args: [owner],
    query: { enabled: contractsConfigured && account.status === "connected" && owner !== zeroAddress && usdc.address !== zeroAddress },
  });

  const { data: vaultBalanceUSDC, refetch: refetchVaultBalanceUSDC } = useReadContract({
    address: policyVault,
    abi: policyVaultAbi,
    functionName: "vaultBalanceOf",
    args: [owner, usdc.address],
    query: { enabled: contractsConfigured && account.status === "connected" && owner !== zeroAddress && policyVault !== zeroAddress && usdc.address !== zeroAddress },
  });

  const { data: vaultBalanceWETH, refetch: refetchVaultBalanceWETH } = useReadContract({
    address: policyVault,
    abi: policyVaultAbi,
    functionName: "vaultBalanceOf",
    args: [owner, weth.address],
    query: { enabled: contractsConfigured && account.status === "connected" && owner !== zeroAddress && policyVault !== zeroAddress && weth.address !== zeroAddress },
  });

  const refreshBalances = useCallback(async () => {
    await Promise.all([refetchTokenBalance(), refetchVaultBalanceUSDC(), refetchVaultBalanceWETH()]);
  }, [refetchTokenBalance, refetchVaultBalanceUSDC, refetchVaultBalanceWETH]);

  const createPolicy = useCallback(async (policy: PolicyDraft): Promise<OnchainPolicyResult> => {
    if (!contractsConfigured) {
      throw new Error("Rail contracts are not configured.");
    }

    const input = tokenForAsset(policy.inputAsset);
    const output = tokenForAsset(policy.outputAsset);
    const now = Math.floor(Date.now() / 1000);
    const hash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "createPolicy",
      args: [
        {
          inputAsset: input.address,
          outputAsset: output.address,
          spendLimit: parseUnits(String(policy.spendPerExecutionUSDC), input.decimals),
          monthlyCap: parseUnits(String(policy.monthlyCapUSDC), input.decimals),
          slippageBps: policy.slippageBps,
          minimumReserve: parseUnits(String(policy.minimumReserveUSDC), input.decimals),
          cooldownSeconds: cooldownSeconds(policy),
          expiresAt: BigInt(now + policy.expiryDays * 86_400),
          agent: asAddress(contractAddresses.agentExecutor),
        },
      ],
    });

    const receipt = await waitForSuccess(hash);
    return { hash, policyId: extractPolicyId(receipt) };
  }, [extractPolicyId, policyVault, waitForSuccess, writeContractAsync]);

  const depositAsset = useCallback(async (asset: string, amountValue: number): Promise<OnchainDepositResult> => {
    if (!contractsConfigured) {
      throw new Error("Rail contracts are not configured.");
    }

    const token = tokenForAsset(asset);
    const amount = parseUnits(String(amountValue), token.decimals);
    const mintHash = await writeContractAsync({
      address: token.address,
      abi: mockUSDCAbi,
      functionName: "mint",
      args: [owner, amount],
    });
    await waitForSuccess(mintHash);

    const approveHash = await writeContractAsync({
      address: token.address,
      abi: mockUSDCAbi,
      functionName: "approve",
      args: [policyVault, amount],
    });
    await waitForSuccess(approveHash);

    const depositHash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "deposit",
      args: [token.address, amount],
    });
    await waitForSuccess(depositHash);
    await refreshBalances();

    return { mintHash, approveHash, depositHash };
  }, [owner, policyVault, refreshBalances, waitForSuccess, writeContractAsync]);

  const withdrawAsset = useCallback(async (asset: string, amountValue: number) => {
    if (!contractsConfigured) {
      throw new Error("Rail contracts are not configured.");
    }

    const token = tokenForAsset(asset);
    const hash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "withdraw",
      args: [token.address, parseUnits(String(amountValue), token.decimals)],
    });
    await waitForSuccess(hash);
    await refreshBalances();
    return hash;
  }, [policyVault, refreshBalances, waitForSuccess, writeContractAsync]);

  const pausePolicy = useCallback(async (policy: PolicyDraft) => {
    const hash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "pausePolicy",
      args: [policyIdOf(policy)],
    });
    await waitForSuccess(hash);
    return hash;
  }, [policyVault, waitForSuccess, writeContractAsync]);

  const resumePolicy = useCallback(async (policy: PolicyDraft) => {
    const hash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "resumePolicy",
      args: [policyIdOf(policy)],
    });
    await waitForSuccess(hash);
    return hash;
  }, [policyVault, waitForSuccess, writeContractAsync]);

  const revokePolicy = useCallback(async (policy: PolicyDraft) => {
    const hash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "revokePolicy",
      args: [policyIdOf(policy)],
    });
    await waitForSuccess(hash);
    return hash;
  }, [policyVault, waitForSuccess, writeContractAsync]);

  return {
    canWriteContracts: contractsConfigured && account.status === "connected",
    createPolicy,
    depositAsset,
    isWriting: isPending,
    pausePolicy,
    refreshBalances,
    resumePolicy,
    revokePolicy,
    tokenBalanceUSDC: typeof tokenBalance === "bigint" ? Number(formatUnits(tokenBalance, usdc.decimals)) : undefined,
    vaultBalanceUSDC: typeof vaultBalanceUSDC === "bigint" ? Number(formatUnits(vaultBalanceUSDC, usdc.decimals)) : undefined,
    vaultBalanceWETH: typeof vaultBalanceWETH === "bigint" ? Number(formatUnits(vaultBalanceWETH, weth.decimals)) : undefined,
    withdrawAsset,
  };
}
