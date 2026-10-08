import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
let pool: Pool | undefined;
export function getDatabase() {
  if (!process.env.DATABASE_URL)
    throw new Error("Todo storage is not configured.");
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    attachDatabasePool(pool);
    pool.on("error", () =>
      console.error(JSON.stringify({ event: "database_connection_failed" })),
    );
  }
  return pool;
}
