// Removes the hosted suite's synthetic accounts from Todo's preview database
// and the issuer preview database. Only reserved .test sink addresses with the
// todo-suite- prefix are touched. Prints counts, never connection details.
import { Pool } from "pg";

const pattern = "todo-suite-%@sink.accounts-preview.test";
const targets = [
  ["todo", process.env.TODO_DATABASE_URL],
  ["issuer", process.env.ISSUER_DATABASE_URL],
];
let failed = false;
for (const [name, connectionString] of targets) {
  if (!connectionString) {
    console.error(`${name}: database setting missing; synthetic accounts were not removed`);
    failed = true;
    continue;
  }
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  try {
    const removed = await pool.query('DELETE FROM "user" WHERE email LIKE $1', [pattern]);
    const left = await pool.query('SELECT count(*)::int AS count FROM "user" WHERE email LIKE $1', [pattern]);
    console.log(`${name}: removed ${removed.rowCount}, remaining ${left.rows[0].count}`);
    if (left.rows[0].count !== 0) failed = true;
  } catch {
    console.error(`${name}: cleanup failed; no connection details are logged`);
    failed = true;
  } finally {
    await pool.end();
  }
}
process.exitCode = failed ? 1 : 0;
