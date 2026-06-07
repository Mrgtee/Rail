import { useCallback } from "react";
import { decodeEventLog, parseUnits, zeroAddress, type Address, type Hash, type TransactionReceipt } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { contractAddresses, contractsConfigured } from "./addresses";
import { mockUSDCAbi, policyVaultAbi } from "./generated";
import type { PolicyDraft, UserAccount } from "../domain/types";

function asAddress(value: string | undefined): Address {
  return (value && value.startsWith("0x") ? value : zeroAddress) as Address;
}

function cooldownSeconds(policy: PolicyDraft) {
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
  const usdc = asAddress(contractAddresses.mockUSDC);
  const outputAsset = asAddress(contractAddresses.mockWETH || contractAddresses.mockUSDC);
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
    address: usdc,
    abi: mockUSDCAbi,
    functionName: "balanceOf",
    args: [owner],
    query: { enabled: contractsConfigured && account.status === "connected" && owner !== zeroAddress && usdc !== zeroAddress },
  });

  const { data: vaultBalance, refetch: refetchVaultBalance } = useReadContract({
    address: policyVault,
    abi: policyVaultAbi,
    functionName: "vaultBalanceOf",
    args: [owner, usdc],
    query: { enabled: contractsConfigured && account.status === "connected" && owner !== zeroAddress && policyVault !== zeroAddress && usdc !== zeroAddress },
  });

  const refreshBalances = useCallback(async () => {
    await Promise.all([refetchTokenBalance(), refetchVaultBalance()]);
  }, [refetchTokenBalance, refetchVaultBalance]);

  const createPolicy = useCallback(async (policy: PolicyDraft): Promise<OnchainPolicyResult> => {
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

    const receipt = await waitForSuccess(hash);
    return { hash, policyId: extractPolicyId(receipt) };
  }, [extractPolicyId, outputAsset, policyVault, usdc, waitForSuccess, writeContractAsync]);

  const depositUSDC = useCallback(async (amountUSDC: number): Promise<OnchainDepositResult> => {
    if (!contractsConfigured) {
      throw new Error("Rail contracts are not configured.");
    }

    const amount = parseUnits(String(amountUSDC), 6);
    const mintHash = await writeContractAsync({
      address: usdc,
      abi: mockUSDCAbi,
      functionName: "mint",
      args: [owner, amount],
    });
    await waitForSuccess(mintHash);

    const approveHash = await writeContractAsync({
      address: usdc,
      abi: mockUSDCAbi,
      functionName: "approve",
      args: [policyVault, amount],
    });
    await waitForSuccess(approveHash);

    const depositHash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "deposit",
      args: [usdc, amount],
    });
    await waitForSuccess(depositHash);
    await refreshBalances();

    return { mintHash, approveHash, depositHash };
  }, [owner, policyVault, refreshBalances, usdc, waitForSuccess, writeContractAsync]);

  const withdrawUSDC = useCallback(async (amountUSDC: number) => {
    if (!contractsConfigured) {
      throw new Error("Rail contracts are not configured.");
    }

    const hash = await writeContractAsync({
      address: policyVault,
      abi: policyVaultAbi,
      functionName: "withdraw",
      args: [usdc, parseUnits(String(amountUSDC), 6)],
    });
    await waitForSuccess(hash);
    await refreshBalances();
    return hash;
  }, [policyVault, refreshBalances, usdc, waitForSuccess, writeContractAsync]);

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
    depositUSDC,
    isWriting: isPending,
    pausePolicy,
    resumePolicy,
    revokePolicy,
    tokenBalanceUSDC: typeof tokenBalance === "bigint" ? Number(tokenBalance) / 1e6 : undefined,
    vaultBalanceUSDC: typeof vaultBalance === "bigint" ? Number(vaultBalance) / 1e6 : undefined,
    withdrawUSDC,
  };
}
