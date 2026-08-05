import { spawnSync } from "node:child_process";

const command = process.env.DATABASE_PROVIDER === "d1"
  ? ["node", ["scripts/apply-d1-migrations.mjs"]]
  : ["npx", ["prisma", "migrate", "deploy"]];

const migrate = spawnSync(command[0], command[1], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

await import("../dist/src/server.js");
