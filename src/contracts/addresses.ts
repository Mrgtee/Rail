export const contractAddresses = {
  policyVault: import.meta.env.VITE_POLICY_VAULT_ADDRESS || "",
  agentExecutor: import.meta.env.VITE_AGENT_EXECUTOR_ADDRESS || "",
  strategyRegistry: import.meta.env.VITE_STRATEGY_REGISTRY_ADDRESS || "",
  mockUSDC: import.meta.env.VITE_MOCK_USDC_ADDRESS || "",
  mockWETH: import.meta.env.VITE_MOCK_WETH_ADDRESS || "",
  mockRouter: import.meta.env.VITE_MOCK_ROUTER_ADDRESS || "",
};

export const contractsConfigured = Boolean(
  contractAddresses.policyVault &&
    contractAddresses.agentExecutor &&
    contractAddresses.mockUSDC &&
    (contractAddresses.mockWETH || contractAddresses.mockUSDC),
);
