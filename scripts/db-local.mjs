import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = "dist/server/wrangler.json";
const persistTo = process.env.QD_DB_STATE ?? ".wrangler/state";
try {
  readFileSync(config);
} catch {
  console.error("Run pnpm build before pnpm db:local.");
  process.exit(1);
}
// Wrangler owns the local D1 database. Keep a per-checkout migration ledger.
const check = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    config,
    "--persist-to",
    persistTo,
    "--command",
    "CREATE TABLE IF NOT EXISTS qd_local_migrations (name TEXT PRIMARY KEY)",
    "--json",
  ],
  { encoding: "utf8" },
);
if (check.status !== 0) {
  console.error(check.stderr || check.stdout);
  process.exit(check.status ?? 1);
}
const query = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    config,
    "--persist-to",
    persistTo,
    "--command",
    "SELECT name FROM qd_local_migrations",
    "--json",
  ],
  { encoding: "utf8" },
);
if (query.status !== 0) {
  console.error(query.stderr || query.stdout);
  process.exit(query.status ?? 1);
}
const applied = new Set(
  JSON.parse(query.stdout)
    .flatMap((r) => r.results ?? [])
    .map((r) => r.name),
);
for (const file of readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (applied.has(file)) continue;
  // Validate migration syntax in an isolated SQLite transaction is handled by API tests.
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      config,
      "--persist-to",
      persistTo,
      "--file",
      "drizzle/" + file,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  const saved = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      config,
      "--persist-to",
      persistTo,
      "--command",
      `INSERT INTO qd_local_migrations(name) VALUES('${file.replaceAll("'", "''")}')`,
    ],
    { stdio: "inherit" },
  );
  if (saved.status !== 0) process.exit(saved.status ?? 1);
}
console.log("Local database is ready.");
