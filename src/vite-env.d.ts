/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAIL_API_URL?: string;
  readonly VITE_ROBINHOOD_RPC_URL?: string;
  readonly VITE_ARBITRUM_SEPOLIA_RPC_URL?: string;
  readonly VITE_POLICY_VAULT_ADDRESS?: string;
  readonly VITE_AGENT_EXECUTOR_ADDRESS?: string;
  readonly VITE_STRATEGY_REGISTRY_ADDRESS?: string;
  readonly VITE_MOCK_USDC_ADDRESS?: string;
  readonly VITE_MOCK_WETH_ADDRESS?: string;
  readonly VITE_MOCK_ROUTER_ADDRESS?: string;
  readonly VITE_ENABLE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
