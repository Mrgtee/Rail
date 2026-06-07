import { createPublicClient, createWalletClient, http, parseUnits, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AgentActionRequest } from "./schemas.js";

const agentExecutorAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "router", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "quotedSlippageBps", type: "uint16" },
      { name: "projectedReserve", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "recordBlocked",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
] as const;

const robinhoodTestnet = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ROBINHOOD_RPC_URL || process.env.VITE_ROBINHOOD_RPC_URL || ""] } },
  blockExplorers: { default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
};

function requiredEnv(name: string, fallbackName?: string) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function configuredAddress(name: string, fallbackName?: string) {
  return requiredEnv(name, fallbackName) as Address;
}

function onchainPolicyId(policyId: string) {
  if (!/^\d+$/.test(policyId)) {
    throw new Error("Policy does not have an onchain numeric ID yet.");
  }

  return BigInt(policyId);
}

function createClients() {
  const rpcUrl = requiredEnv("ROBINHOOD_RPC_URL", "VITE_ROBINHOOD_RPC_URL");
  const rawPrivateKey = requiredEnv("AGENT_PRIVATE_KEY");
  const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = {
    ...robinhoodTestnet,
    rpcUrls: { default: { http: [rpcUrl] } },
  };

  return {
    account,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    walletClient: createWalletClient({ account, chain, transport: http(rpcUrl) }),
  };
}

async function waitForSuccess(hash: Hash) {
  const { publicClient } = createClients();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Agent transaction failed: ${hash}`);
  }

  return receipt;
}

export function railContractsConfigured() {
  return Boolean(
    (process.env.ROBINHOOD_RPC_URL || process.env.VITE_ROBINHOOD_RPC_URL) &&
      process.env.AGENT_PRIVATE_KEY &&
      (process.env.AGENT_EXECUTOR_ADDRESS || process.env.VITE_AGENT_EXECUTOR_ADDRESS) &&
      (process.env.MOCK_ROUTER_ADDRESS || process.env.VITE_MOCK_ROUTER_ADDRESS),
  );
}

export async function submitAgentExecution(request: AgentActionRequest) {
  const { walletClient } = createClients();
  const hash = await walletClient.writeContract({
    address: configuredAddress("AGENT_EXECUTOR_ADDRESS", "VITE_AGENT_EXECUTOR_ADDRESS"),
    abi: agentExecutorAbi,
    functionName: "execute",
    args: [
      onchainPolicyId(request.policy.id),
      configuredAddress("MOCK_ROUTER_ADDRESS", "VITE_MOCK_ROUTER_ADDRESS"),
      parseUnits(String(request.action.amountUSDC), 6),
      request.action.slippageBps,
      parseUnits(String(request.action.projectedReserveUSDC), 6),
      "0x",
    ],
  });

  await waitForSuccess(hash);
  return hash;
}

export async function submitBlockedAction(request: AgentActionRequest, reason: string) {
  const { walletClient } = createClients();
  const hash = await walletClient.writeContract({
    address: configuredAddress("AGENT_EXECUTOR_ADDRESS", "VITE_AGENT_EXECUTOR_ADDRESS"),
    abi: agentExecutorAbi,
    functionName: "recordBlocked",
    args: [onchainPolicyId(request.policy.id), reason],
  });

  await waitForSuccess(hash);
  return hash;
}
