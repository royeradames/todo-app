import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrationTarget } from "./migration-target";

// Applies one reviewed, additive upgrade to a migrated store (development or production), once.
// Usage: node --import tsx scripts/apply-upgrade.ts 0003_rc5_federation --reviewed-sha256=HASH
const revision = process.argv[2] ?? "";
const reviewedHash = process.argv.find((value) => value.startsWith("--reviewed-sha256="))?.split("=")[1];
if (!/^\d{4}_[a-z0-9_]+$/.test(revision)) throw new Error("Name the upgrade revision, for example 0003_rc5_federation.");
const { name: targetName, connectionString } = migrationTarget(process.argv);
const sql = await readFile(new URL(`../migrations/${revision}.sql`, import.meta.url), "utf8");
const actualHash = createHash("sha256").update(sql).digest("hex");
if (!reviewedHash || reviewedHash !== actualHash) throw new Error("Supply the independently reviewed upgrade SHA-256.");
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(707202610)");
  const foundation = await client.query("SELECT 1 FROM todo_schema_migrations WHERE revision = 'foundation'");
  if (!foundation.rows.length) throw new Error("The foundation migration must be applied first.");
  const done = await client.query("SELECT sha256 FROM todo_schema_migrations WHERE revision = $1", [revision]);
  if (done.rows.length) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ applied: false, alreadyApplied: true, revision }));
  } else {
    await client.query(sql);
    await client.query("INSERT INTO todo_schema_migrations(revision,sha256) VALUES($1, $2)", [revision, actualHash]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ applied: true, target: targetName, revision, sha256: actualHash }));
  }
} catch {
  await client.query("ROLLBACK");
  console.error("Upgrade failed; transaction rolled back. No raw database details are logged.");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
