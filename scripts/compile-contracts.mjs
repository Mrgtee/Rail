import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const outputDir = path.join(root, "contracts", "build");
const sources = [
  "contracts/src/PolicyVault.sol",
  "contracts/src/AgentExecutor.sol",
  "contracts/src/StrategyRegistry.sol",
  "contracts/src/MockUSDC.sol",
  "contracts/src/MockRouter.sol",
];

function findImport(importPath) {
  const candidates = [
    path.join(root, importPath),
    path.join(root, "node_modules", importPath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

const input = {
  language: "Solidity",
  sources: Object.fromEntries(
    sources.map((source) => [source, { content: fs.readFileSync(path.join(root, source), "utf8") }]),
  ),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
const errors = output.errors ?? [];
const fatalErrors = errors.filter((error) => error.severity === "error");

for (const error of errors) {
  console.error(error.formattedMessage);
}

if (fatalErrors.length > 0) {
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

for (const [fileName, contracts] of Object.entries(output.contracts)) {
  for (const [contractName, artifact] of Object.entries(contracts)) {
    const baseName = `${path.basename(fileName, ".sol")}_${contractName}`;
    fs.writeFileSync(path.join(outputDir, `${baseName}.abi`), JSON.stringify(artifact.abi, null, 2));
    fs.writeFileSync(path.join(outputDir, `${baseName}.bin`), artifact.evm.bytecode.object);
  }
}

console.log(`Compiled ${sources.length} Solidity files to ${path.relative(root, outputDir)}`);
