export const contractAddresses = {
  policyVault: import.meta.env.VITE_POLICY_VAULT_ADDRESS || "",
  agentExecutor: import.meta.env.VITE_AGENT_EXECUTOR_ADDRESS || "",
  strategyRegistry: import.meta.env.VITE_STRATEGY_REGISTRY_ADDRESS || "",
  mockUSDC: import.meta.env.VITE_MOCK_USDC_ADDRESS || "",
  mockRouter: import.meta.env.VITE_MOCK_ROUTER_ADDRESS || "",
};

export const contractsConfigured = Object.values(contractAddresses).some(Boolean);
