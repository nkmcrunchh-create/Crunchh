import fs from "node:fs";
import { spawnSync } from "node:child_process";

const envPath = process.argv[2] || ".env.production";
const namesPath = process.argv[3] || "cloudflare.secret-names.txt";

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Create it from .env.example and fill production values.`);
  process.exit(1);
}

const envText = fs.readFileSync(envPath, "utf8");
const names = fs.readFileSync(namesPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

const values = parseEnv(envText);
let missing = 0;

for (const name of names) {
  const value = values.get(name);
  if (!value) {
    console.error(`Missing value for ${name}`);
    missing += 1;
    continue;
  }
  process.stdout.write(`Setting ${name}... `);
  const result = spawnSync("npx", ["wrangler", "secret", "put", name], {
    input: value,
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.stdout.write("failed\n");
    process.stderr.write(result.stderr.toString());
    process.exit(result.status ?? 1);
  }
  process.stdout.write("ok\n");
}

if (missing) {
  console.error(`${missing} required secret(s) missing. Nothing was printed, but incomplete Cloudflare secrets will block production startup.`);
  process.exit(1);
}
