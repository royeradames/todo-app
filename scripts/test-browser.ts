import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
if (
  process.env.TODO_RUN_DATABASE_TESTS !== "1" ||
  process.env.NEON_PROJECT_ID !== "rough-haze-94222851" ||
  process.env.AUTH_BASE_URL !== "http://localhost:4325"
) {
  throw new Error(
    "Browser accounts require the explicitly enabled assigned development fixture.",
  );
}
const direct = process.env.DATABASE_URL_UNPOOLED;
if (!direct) throw new Error("Direct development connection is required.");
const schema = `todo_browser_${randomUUID().replaceAll("-", "")}`;
const setup = new Pool({
  connectionString: direct,
  max: 1,
  connectionTimeoutMillis: 10000,
});
const isolated = new URL(direct);
isolated.searchParams.set("options", `-c search_path=${schema}`);
const fixture = new Pool({
  connectionString: isolated.toString(),
  max: 1,
  connectionTimeoutMillis: 10000,
});
let created = false;
let fixtureEnded = false;
let publicTablesBefore = 0;
try {
  publicTablesBefore = Number(
    (
      await setup.query(
        "SELECT count(*) FROM pg_tables WHERE schemaname='public'",
      )
    ).rows[0].count,
  );
  await setup.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  const sql = (
    await Promise.all(
      ["0001_auth.sql", "0002_todos.sql"].map((name) =>
        readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  await fixture.query(sql);
  await fixture.end();
  fixtureEnded = true;
  const child = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: isolated.toString(),
        DATABASE_URL_UNPOOLED: isolated.toString(),
      },
    },
  );
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} catch {
  console.error(
    "Synthetic browser verification failed; no connection details are logged.",
  );
  process.exitCode = 1;
} finally {
  if (!fixtureEnded) await fixture.end();
  try {
    if (created) await setup.query(`DROP SCHEMA "${schema}" CASCADE`);
    const remaining = Number(
      (
        await setup.query(
          "SELECT count(*) FROM pg_namespace WHERE nspname=$1",
          [schema],
        )
      ).rows[0].count,
    );
    const publicTablesAfter = Number(
      (
        await setup.query(
          "SELECT count(*) FROM pg_tables WHERE schemaname='public'",
        )
      ).rows[0].count,
    );
    await mkdir(".test-state", { recursive: true });
    await writeFile(
      ".test-state/browser-result.json",
      JSON.stringify(
        {
          package: "0.1.0-rc.1",
          packageReleaseHold: true,
          passed: process.exitCode === 0,
          ownedSchemaRemaining: remaining,
          publicTablesBefore,
          publicTablesAfter,
          realMailSent: false,
          time: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    if (remaining !== 0 || publicTablesAfter !== publicTablesBefore)
      throw new Error("Synthetic fixture cleanup did not pass.");
  } finally {
    await setup.end();
  }
}
