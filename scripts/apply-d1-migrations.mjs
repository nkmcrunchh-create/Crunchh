import fs from "node:fs";
import path from "node:path";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const token = process.env.CLOUDFLARE_D1_API_TOKEN;

if (!accountId || !databaseId || !token) {
  console.error("Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, or CLOUDFLARE_D1_API_TOKEN.");
  process.exit(1);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !statement.startsWith("--"));
}

async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ sql, params })
  });
  const body = await response.json();
  if (!response.ok || !body.success || !body.result?.[0]?.success) {
    console.error(JSON.stringify(body, null, 2));
    throw new Error(`D1 migration query failed: ${sql.slice(0, 120)}`);
  }
  return body.result[0];
}

await query("CREATE TABLE IF NOT EXISTS d1_migrations (name TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)");

const dir = path.join(process.cwd(), "d1", "migrations");
const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const applied = await query("SELECT name FROM d1_migrations WHERE name = ?", [file]);
  if (applied.results?.length) {
    console.log(`D1 migration already applied: ${file}`);
    continue;
  }
  console.log(`Applying D1 migration: ${file}`);
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  for (const statement of splitSql(sql)) {
    await query(statement);
  }
  await query("INSERT INTO d1_migrations (name, appliedAt) VALUES (?, ?)", [file, new Date().toISOString()]);
}
