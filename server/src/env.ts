import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const candidates = [path.join(root, ".env.local"), path.join(root, ".env")];

for (const filePath of candidates) {
  if (!fs.existsSync(filePath)) continue;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
