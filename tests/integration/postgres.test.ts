import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { z } from "zod";
import { createTodoStore, TodoConflict } from "../../src/lib/todos/store";

const allowed = process.env.TODO_RUN_DATABASE_TESTS === "1";
test(
  "real PostgreSQL: principals own separate durable lists and concurrent writes conflict",
  { skip: !allowed, timeout: 60000 },
  async () => {
    assert.equal(
      process.env.NEON_PROJECT_ID,
      "rough-haze-94222851",
      "Only the assigned development database is accepted",
    );
    assert.equal(process.env.AUTH_BASE_URL, "http://localhost:4325");
    const connectionString = process.env.DATABASE_URL_UNPOOLED;
    assert.ok(connectionString, "Direct development connection is configured");
    const schema = `todo_test_${randomUUID().replaceAll("-", "")}`;
    const setup = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 10000,
    });
    const database = new Pool({
      connectionString,
      max: 4,
      options: `-c search_path=${schema}`,
      connectionTimeoutMillis: 10000,
    });
    let created = false;
    let passed = false;
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
            readFile(
              new URL(`../../migrations/${name}`, import.meta.url),
              "utf8",
            ),
          ),
        )
      ).join("\n");
      await database.query(sql);
      // Central mode creates local principals at the federation callback.
      // The store only needs two immutable principal IDs, so insert them.
      const person = async (index: number) => {
        const id = `synthetic-${randomUUID()}`;
        await database.query(
          'INSERT INTO "user" (id, name, email, "emailVerified", "updatedAt") VALUES ($1, $2, $3, true, now())',
          [id, `Synthetic Todo ${index}`, `todo-${randomUUID()}@example.test`],
        );
        return { id };
      };
      const owner = await person(1),
        other = await person(2);
      const federationTables = await database.query(
        "SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename LIKE 'federation%' ORDER BY 1",
        [schema],
      );
      assert.deepEqual(
        federationTables.rows.map((row) => row.tablename),
        ["federationGrant", "federationIdentity", "federationTransaction"],
        "The reviewed migration creates the central sign-in tables",
      );
      assert.notEqual(owner.id, other.id);
      const store = createTodoStore(database);
      assert.deepEqual(await store.read(owner.id), { version: 0, items: [] });
      const added = await store.change(owner.id, 0, {
        kind: "add",
        title: "Synthetic owner task",
      });
      assert.equal(added.version, 1);
      assert.equal(added.items.length, 1);
      assert.deepEqual(
        await store.read(other.id),
        { version: 0, items: [] },
        "Another principal sees an empty list",
      );
      await assert.rejects(
        store.change(other.id, 0, { kind: "remove", id: added.items[0].id }),
        "Foreign task cannot be deleted",
      );
      assert.deepEqual(
        await store.read(owner.id),
        added,
        "Rejected foreign operation preserves the owner list",
      );
      const outcomes = await Promise.allSettled([
        store.change(owner.id, 1, { kind: "add", title: "Synthetic tab one" }),
        store.change(owner.id, 1, { kind: "add", title: "Synthetic tab two" }),
      ]);
      assert.equal(
        outcomes.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        outcomes.filter(
          (result) =>
            result.status === "rejected" &&
            result.reason instanceof TodoConflict,
        ).length,
        1,
      );
      const persisted = await createTodoStore(database).read(owner.id);
      assert.equal(persisted.version, 2);
      assert.equal(persisted.items.length, 2);
      const reversed = await store.change(owner.id, 2, {
        kind: "reorder",
        ids: persisted.items.map((item) => item.id).reverse(),
      });
      assert.deepEqual(
        reversed.items.map((item) => item.id),
        persisted.items.map((item) => item.id).reverse(),
        "Deferrable positions allow a real SQL reorder",
      );
      await database.query('DELETE FROM "user" WHERE id=$1', [owner.id]);
      assert.equal(
        (
          await database.query(
            "SELECT count(*)::int AS count FROM todo_items WHERE owner_id=$1",
            [owner.id],
          )
        ).rows[0].count,
        0,
        "Removing a principal removes its tasks",
      );
      assert.equal(
        (await store.read(other.id)).version,
        0,
        "Removing one principal leaves another list untouched",
      );
      const count = await setup.query(
        "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname=$1",
        [schema],
      );
      assert.ok(
        z.object({ count: z.number().positive() }).parse(count.rows[0]).count,
      );
      passed = true;
    } finally {
      await database.end();
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
          ".test-state/postgres-result.json",
          JSON.stringify(
            {
              package: "0.1.0-rc.1",
              packageReleaseHold: true,
              passed,
              isolatedSchemaCreated: created,
              ownedSchemaRemaining: remaining,
              publicTablesBefore,
              publicTablesAfter,
              realMailSent: false,
              realRecordsRead: false,
              time: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
        assert.equal(remaining, 0, "Owned test schema is gone after cleanup");
        assert.equal(
          publicTablesAfter,
          publicTablesBefore,
          "Public schema was not changed",
        );
      } finally {
        await setup.end();
      }
    }
  },
);
