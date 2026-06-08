# Rail

Rail is a non-custodial agentic finance app that lets users automate onchain investing while enforcing spending, asset, timing, slippage, reserve, and expiry limits through smart contracts.

The core thesis is simple: the AI agent can propose and submit actions, but `PolicyVault` is the final authority. If an action violates the signed policy, the action is blocked and the user sees why.

## What is built

- React/Vite frontend for connect -> goal -> AI draft -> policy review -> activation -> dashboard.
- Wallet/chain integration with `wagmi`, `viem`, React Query, Robinhood Chain Testnet primary, and Arbitrum Sepolia secondary.
- Hono backend agent service with policy drafting, validation, simulation, execution, activity, and health endpoints.
- Solidity contracts for `PolicyVault`, `AgentExecutor`, `StrategyRegistry`, `MockUSDC`, and `MockRouter`.
- Foundry-shaped tests and deployment script.
- Optional Rust/Stylus proof module for policy risk evaluation.
- Demo operator controls for valid execution, blocked slippage, and blocked overspend.

## Architecture

```mermaid
flowchart LR
  User[User wallet] --> Frontend[Rail frontend]
  Frontend --> Agent[Hono agent backend]
  Agent --> Draft[Policy draft + validation]
  Frontend --> Wallet[wagmi / viem]
  Wallet --> Vault[PolicyVault.sol]
  Agent --> Executor[AgentExecutor.sol]
  Executor --> Vault
  Vault --> Router[MockRouter / DEX route]
  Vault --> Events[Contract events + activity feed]
  Events --> Frontend
```

## Local setup

```bash
npm install
cp .env.example .env.local
```

Do not commit `.env`, `.env.local`, private keys, RPC secrets, or deployer wallets. The repo ignores those files.

## Environment variables

Frontend:

```bash
VITE_RAIL_API_URL=http://localhost:8787
VITE_ROBINHOOD_RPC_URL=
VITE_ARBITRUM_SEPOLIA_RPC_URL=
VITE_POLICY_VAULT_ADDRESS=
VITE_AGENT_EXECUTOR_ADDRESS=
VITE_STRATEGY_REGISTRY_ADDRESS=
VITE_MOCK_USDC_ADDRESS=
VITE_MOCK_WETH_ADDRESS=
VITE_MOCK_ROUTER_ADDRESS=
```

Backend:

```bash
OPENAI_API_KEY=
OPENAI_AGENTS_DISABLE_TRACING=true
ROBINHOOD_RPC_URL=
ARBITRUM_SEPOLIA_RPC_URL=
AGENT_PRIVATE_KEY=
POLICY_VAULT_ADDRESS=
AGENT_EXECUTOR_ADDRESS=
STRATEGY_REGISTRY_ADDRESS=
MOCK_USDC_ADDRESS=
MOCK_WETH_ADDRESS=
MOCK_ROUTER_ADDRESS=
USDC_USD_PRICE_E8=100000000
WETH_USD_PRICE_E8=160000000000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

If `OPENAI_API_KEY` is missing, the backend uses a deterministic policy parser for drafting. Wallet connection, deployed contract addresses, and Robinhood Chain Testnet funds are required for policy activation, deposits, withdrawals, and agent execution.

## Commands

```bash
npm run dev:frontend      # frontend on Vite
npm run dev:backend       # Hono agent service on http://localhost:8787
npm run build             # frontend typecheck + build
npm run build:backend     # backend typecheck
npm run contracts:build   # compile Solidity contracts with local solc via-IR
npm run contracts:sync    # sync compiled ABIs into src/contracts/generated.ts
npm run verify            # frontend + backend + contract compile
```

Optional commands when external tooling is installed:

```bash
forge test
npm run contracts:deploy:local
npm run stylus:test
npm run stylus:check
```

`forge` and `cargo` were not installed in the current environment during implementation, so Foundry and Stylus tests are included but were not runnable here.

## Backend API

- `GET /api/health` returns backend, OpenAI, RPC, and contract configuration health.
- `POST /api/policies/draft` converts a user goal into a strict policy object.
- `POST /api/policies/validate` validates policy limits.
- `POST /api/agent/simulate` checks whether an agent action should execute or block.
- `POST /api/agent/execute` records an executed or blocked demo action.
- `GET /api/activity/:wallet` returns stored activity for a wallet.

## Demo script

1. Start the backend: `npm run dev:backend`.
2. Start the frontend: `npm run dev:frontend`.
3. Open the Vite URL.
4. Connect a browser wallet funded on Robinhood Chain Testnet.
5. Enter a goal like: `DCA 20 USDC into ETH every week. Stop if slippage is above 1%.` Add `Keep 50 USDC liquid` only when you want an explicit reserve.
6. Generate and review the policy.
7. Sign/activate the policy. Without contract env vars this uses demo mode.
8. On the dashboard, run:
   - `Run Valid DCA` to show a permitted action.
   - `Trigger Slippage Block` to show a policy rejection.
   - `Trigger Overspend Block` to show a spend-limit rejection.
9. Open an activity item to inspect the attempted action, rule, simulation result, and transaction/proof status.

## Contract deployment notes

Foundry project settings live in `foundry.toml`. This repo also includes a Node/viem deployment path for environments where Foundry is not installed:

```bash
npm run contracts:deploy:robinhood
```

The deploy script reads `.env.local`, deploys the Rail contracts to Robinhood Chain Testnet, initializes executor authorization, router minter permissions, router token prices, and strategy settings, writes public metadata to `deployments/robinhood-testnet.json`, and updates local address fields in `.env.local`.

Optional Foundry path when `forge` is installed:

```bash
forge script contracts/script/DeployLocal.s.sol --broadcast --rpc-url $ROBINHOOD_RPC_URL
```

Current Robinhood Chain Testnet deployment:

- PolicyVault: `0xeb56aef6753d8ba0877154be0a54709809408d28`
- AgentExecutor: `0x748e33595c31c79b140b2c2ab035373c9459da32`
- StrategyRegistry: `0x1725ec14566f07ba0b52072358354c496c0458c4`
- MockUSDC: `0xa91cea564593980b8c31c85c95e723a8ffdbb3c5`
- MockWETH: `0x44c36bb8f2f445eae226407325a7bbda17542e74`
- MockRouter: `0xb0e9d87b95361d04e108560811e617f6306c210e`

Explorer: https://explorer.testnet.chain.robinhood.com

Router prices: rUSDC = 1 USD, rWETH = 1600 USD.


## Verification performed

Successfully run in this environment:

- `npm run build`
- `npm run build:backend`
- `npm run contracts:build`
- backend runtime health check
- backend blocked execution smoke request

Not run because required external tools are unavailable:

- `forge test`: `forge` not installed
- `npm run stylus:test`: `cargo` not installed

## Security posture

- Users must approve policy activation.
- Agent actions are checked against policy limits before execution.
- Blocked actions move no funds.
- The backend never receives user private keys.
- Secrets are excluded through `.gitignore` and should remain local only.
