import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { configureAuth } from "../src/lib/auth-config";
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString || new URL(connectionString).hostname.includes("-pooler"))
  throw new Error("Use the configured direct development connection.");
const pool = new Pool({ connectionString, max: 1 });
try {
  const auth = configureAuth(pool, async () => {
    throw new Error("Migration planning never sends mail.");
  });
  const plan = await getMigrations(auth.engine.options);
  if (plan.unsafeChanges.length || plan.schemaProblems.length)
    throw new Error("Review the schema mismatch before migration.");
  const authSQL = await plan.compileMigrations();
  await writeFile("migrations/0001_auth.sql", authSQL);
  const todoSQL = await readFile("migrations/0002_todos.sql", "utf8");
  const sha256 = createHash("sha256")
    .update([authSQL, todoSQL].join("\n"))
    .digest("hex");
  console.log(
    JSON.stringify({
      planned: true,
      applied: false,
      createdTables: plan.toBeCreated.map((table) => table.table),
      combinedSHA256: sha256,
    }),
  );
} catch {
  console.error("Migration planning failed; no SQL was applied.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
