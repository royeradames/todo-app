import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrationTarget } from "./migration-target";

// This first migration only initializes a named, empty store (development or production).
// Hosted rollout is a separate reviewed operation, not an app-startup side effect.
const reviewedHash = process.argv
  .find((value) => value.startsWith("--reviewed-sha256="))
  ?.split("=")[1];
const { name: targetName, connectionString } = migrationTarget(process.argv);
const sql = (
  await Promise.all(
    ["0001_auth.sql", "0002_todos.sql"].map((name) =>
      readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
    ),
  )
).join("\n");
const actualHash = createHash("sha256").update(sql).digest("hex");
if (!reviewedHash || reviewedHash !== actualHash)
  throw new Error(
    "Supply the independently reviewed combined migration SHA-256.",
  );
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(707202610)");
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  if (tables.rows.length)
    throw new Error(
      "First migration requires an empty development schema; do not alter an existing account store.",
    );
  await client.query(sql);
  await client.query(
    "CREATE TABLE todo_schema_migrations (revision text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await client.query(
    "INSERT INTO todo_schema_migrations(revision,sha256) VALUES('foundation', $1)",
    [actualHash],
  );
  await client.query("COMMIT");
  console.log(
    JSON.stringify({
      applied: true,
      target: targetName,
      revision: "foundation",
      sha256: actualHash,
    }),
  );
} catch {
  await client.query("ROLLBACK");
  console.error(
    "Development migration failed; transaction rolled back. No raw database details are logged.",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
