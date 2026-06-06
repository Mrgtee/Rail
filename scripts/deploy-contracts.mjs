import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const buildDir = path.join(root, "contracts", "build");
const deploymentsDir = path.join(root, "deployments");
const deploymentPath = path.join(deploymentsDir, "robinhood-testnet.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

function getEnv(name, options = {}) {
  const value = process.env[name] || fileEnv[name] || "";
  if (options.required && !value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function artifact(contractName) {
  const abiPath = path.join(buildDir, `${contractName}_${contractName}.abi`);
  const binPath = path.join(buildDir, `${contractName}_${contractName}.bin`);

  if (!fs.existsSync(abiPath) || !fs.existsSync(binPath)) {
    throw new Error(`Missing compiled artifact for ${contractName}. Run npm run contracts:build first.`);
  }

  const bytecode = fs.readFileSync(binPath, "utf8").trim();
  return {
    abi: JSON.parse(fs.readFileSync(abiPath, "utf8")),
    bytecode: `0x${bytecode}`,
  };
}

function updateEnvFile(filePath, values) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split(/\r?\n/) : [];
  const seen = new Set();
  const updated = existing.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match || !(match[1] in values)) return line;

    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) updated.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, `${updated.filter((line, index, lines) => index < lines.length - 1 || line !== "").join("\n")}\n`);
}

async function waitForDeployment(publicClient, hash, label) {
  console.log(`${label} tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`${label} deployment failed: ${hash}`);
  }

  console.log(`${label} deployed ${receipt.contractAddress}`);
  return receipt;
}

async function waitForWrite(publicClient, hash, label) {
  console.log(`${label} tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} failed: ${hash}`);
  }

  return receipt;
}

async function deployContract(walletClient, publicClient, name, args = []) {
  const compiled = artifact(name);
  const hash = await walletClient.deployContract({
    abi: compiled.abi,
    bytecode: compiled.bytecode,
    args,
  });
  const receipt = await waitForDeployment(publicClient, hash, name);
  return { abi: compiled.abi, address: receipt.contractAddress, txHash: hash };
}

const fileEnv = loadEnvFile(envPath);
const rpcUrl = getEnv("ROBINHOOD_RPC_URL", { required: true });
const privateKey = getEnv("AGENT_PRIVATE_KEY", { required: true });
const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
const agentAddress = getEnv("AGENT_ADDRESS") || account.address;

const robinhoodTestnet = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
};

const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: robinhoodTestnet,
  transport: http(rpcUrl),
});

const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) {
  throw new Error(`Deployer ${account.address} has no ETH on Robinhood Chain Testnet.`);
}

console.log(`Deploying Rail contracts to Robinhood Chain Testnet from ${account.address}`);
console.log(`Agent address ${agentAddress}`);

const mockUSDC = await deployContract(walletClient, publicClient, "MockUSDC", ["Rail Demo USDC", "rUSDC", 6]);
const mockWETH = await deployContract(walletClient, publicClient, "MockUSDC", ["Rail Demo WETH", "rWETH", 18]);
const mockRouter = await deployContract(walletClient, publicClient, "MockRouter");
const strategyRegistry = await deployContract(walletClient, publicClient, "StrategyRegistry");
const policyVault = await deployContract(walletClient, publicClient, "PolicyVault", ["0x0000000000000000000000000000000000000000"]);
const agentExecutor = await deployContract(walletClient, publicClient, "AgentExecutor", [policyVault.address, agentAddress]);

const policyVaultArtifact = artifact("PolicyVault");
const mockRouterArtifact = artifact("MockRouter");
const strategyRegistryArtifact = artifact("StrategyRegistry");

const initTxs = [];

initTxs.push({
  label: "PolicyVault.setExecutor",
  hash: await walletClient.writeContract({
    address: policyVault.address,
    abi: policyVaultArtifact.abi,
    functionName: "setExecutor",
    args: [agentExecutor.address, true],
  }),
});
await waitForWrite(publicClient, initTxs.at(-1).hash, initTxs.at(-1).label);

initTxs.push({
  label: "MockRouter.setRate",
  hash: await walletClient.writeContract({
    address: mockRouter.address,
    abi: mockRouterArtifact.abi,
    functionName: "setRate",
    args: [mockUSDC.address, mockWETH.address, 10_000n],
  }),
});
await waitForWrite(publicClient, initTxs.at(-1).hash, initTxs.at(-1).label);

initTxs.push({
  label: "StrategyRegistry.setStrategy",
  hash: await walletClient.writeContract({
    address: strategyRegistry.address,
    abi: strategyRegistryArtifact.abi,
    functionName: "setStrategy",
    args: [keccak256(toBytes("DCA")), "DCA", "ipfs://rail-demo-dca", true],
  }),
});
await waitForWrite(publicClient, initTxs.at(-1).hash, initTxs.at(-1).label);

fs.mkdirSync(deploymentsDir, { recursive: true });

const deployment = {
  chainId: robinhoodTestnet.id,
  chainName: robinhoodTestnet.name,
  explorer: robinhoodTestnet.blockExplorers.default.url,
  deployedAt: new Date().toISOString(),
  deployer: account.address,
  agent: agentAddress,
  contracts: {
    policyVault: { address: policyVault.address, txHash: policyVault.txHash },
    agentExecutor: { address: agentExecutor.address, txHash: agentExecutor.txHash },
    strategyRegistry: { address: strategyRegistry.address, txHash: strategyRegistry.txHash },
    mockUSDC: { address: mockUSDC.address, txHash: mockUSDC.txHash },
    mockWETH: { address: mockWETH.address, txHash: mockWETH.txHash },
    mockRouter: { address: mockRouter.address, txHash: mockRouter.txHash },
  },
  initialization: initTxs,
};

fs.writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);

updateEnvFile(envPath, {
  VITE_POLICY_VAULT_ADDRESS: policyVault.address,
  VITE_AGENT_EXECUTOR_ADDRESS: agentExecutor.address,
  VITE_STRATEGY_REGISTRY_ADDRESS: strategyRegistry.address,
  VITE_MOCK_USDC_ADDRESS: mockUSDC.address,
  VITE_MOCK_WETH_ADDRESS: mockWETH.address,
  VITE_MOCK_ROUTER_ADDRESS: mockRouter.address,
  POLICY_VAULT_ADDRESS: policyVault.address,
  AGENT_EXECUTOR_ADDRESS: agentExecutor.address,
});

console.log(`Wrote ${path.relative(root, deploymentPath)}`);
console.log("Updated .env.local address fields");
