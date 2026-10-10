import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod/mini";
import {
  applyCommand,
  snapshotSchema,
  type TodoCommand,
  type TodoSnapshot,
} from "./model";

export class TodoConflict extends Error {}
const versionSchema = z.object({ version: z.int().check(z.nonnegative()) });
async function snapshot(
  client: PoolClient,
  ownerId: string,
): Promise<TodoSnapshot> {
  const result = await client.query(
    `SELECT COALESCE(l.version, 0) AS version,
    COALESCE(json_agg(json_build_object('id', t.id, 'title', t.title, 'completed', t.completed) ORDER BY t.position)
      FILTER (WHERE t.id IS NOT NULL), '[]'::json) AS items
    FROM (SELECT $1::text AS owner_id) person
    LEFT JOIN todo_lists l USING(owner_id) LEFT JOIN todo_items t USING(owner_id) GROUP BY l.version`,
    [ownerId],
  );
  return snapshotSchema.parse(result.rows[0]);
}
export function createTodoStore(pool: Pool) {
  return {
    async read(ownerId: string) {
      const client = await pool.connect();
      try {
        return await snapshot(client, ownerId);
      } finally {
        client.release();
      }
    },
    async change(
      ownerId: string,
      expectedVersion: number,
      command: TodoCommand,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "INSERT INTO todo_lists(owner_id) VALUES($1) ON CONFLICT DO NOTHING",
          [ownerId],
        );
        const locked = await client.query(
          "SELECT version FROM todo_lists WHERE owner_id=$1 FOR UPDATE",
          [ownerId],
        );
        if (versionSchema.parse(locked.rows[0]).version !== expectedVersion)
          throw new TodoConflict(
            "Your list changed in another tab. It has been refreshed.",
          );
        const current = await snapshot(client, ownerId);
        const next = applyCommand(current.items, command, randomUUID);
        // All writes are under this person's list lock. Existing IDs and content
        // remain domain data; a browser never supplies an owner or SQL fragment.
        await client.query(
          "DELETE FROM todo_items WHERE owner_id=$1 AND NOT(id=ANY($2::uuid[]))",
          [ownerId, next.map((item) => item.id)],
        );
        if (next.length) {
          const persisted = await client.query(
            `INSERT INTO todo_items(id, owner_id, title, completed, position)
          SELECT x.id, $1, x.title, x.completed, x.position FROM jsonb_to_recordset($2::jsonb)
            AS x(id uuid, title text, completed boolean, position integer)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title, completed=excluded.completed, position=excluded.position
            WHERE todo_items.owner_id=excluded.owner_id`,
            [
              ownerId,
              JSON.stringify(
                next.map((item, position) => ({ ...item, position })),
              ),
            ],
          );
          if (persisted.rowCount !== next.length)
            throw new Error("Task storage rejected the change.");
        }
        const updated = await client.query(
          "UPDATE todo_lists SET version=version+1 WHERE owner_id=$1 RETURNING version",
          [ownerId],
        );
        await client.query("COMMIT");
        return {
          version: versionSchema.parse(updated.rows[0]).version,
          items: next,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
