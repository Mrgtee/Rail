export const policyVaultAbi = [
  {
    type: "function",
    name: "createPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "inputAsset", type: "address" },
      { name: "outputAsset", type: "address" },
      { name: "spendLimit", type: "uint256" },
      { name: "monthlyCap", type: "uint256" },
      { name: "slippageBps", type: "uint16" },
      { name: "minimumReserve", type: "uint256" },
      { name: "cooldownSeconds", type: "uint32" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "policyId", type: "uint256" }],
  },
  {
    type: "function",
    name: "pausePolicy",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revokePolicy",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const;
