import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { z } from "zod";
import { configureAuth, type AuthMail } from "../../src/lib/auth-config";
import { createTodoStore, TodoConflict } from "../../src/lib/todos/store";

const allowed = process.env.TODO_RUN_DATABASE_TESTS === "1";
test(
  "real PostgreSQL: verified principals own separate durable lists and concurrent writes conflict",
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
      const messages: Array<AuthMail & { kind: string }> = [];
      const auth = configureAuth(database, async (kind, mail) => {
        messages.push({ ...mail, kind });
      });
      const origin = "http://localhost:4325";
      function browser() {
        const cookies = new Map<string, string>();
        return {
          headers() {
            return new Headers({
              cookie: [...cookies]
                .map(([key, value]) => `${key}=${value}`)
                .join("; "),
            });
          },
          async request(path: string, body?: unknown) {
            const headers = this.headers();
            headers.set("origin", origin);
            if (body !== undefined)
              headers.set("content-type", "application/json");
            const response = await auth.handler(
              new Request(new URL(`/api/auth${path}`, origin), {
                method: body === undefined ? "GET" : "POST",
                headers,
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              }),
            );
            for (const cookie of response.headers.getSetCookie()) {
              const pair = cookie.split(";")[0],
                separator = pair.indexOf("=");
              const key = pair.slice(0, separator),
                value = pair.slice(separator + 1);
              if (value) cookies.set(key, value);
              else cookies.delete(key);
            }
            return response;
          },
        };
      }
      const first = browser(),
        second = browser();
      const identity = (index: number) => ({
        name: `Synthetic Todo ${index}`,
        email: `todo-${randomUUID()}@example.test`,
        password: randomUUID() + " synthetic passphrase",
      });
      const a = identity(1),
        b = identity(2);
      for (const [person, account] of [
        [first, a],
        [second, b],
      ] as const) {
        assert.equal(
          (await person.request("/sign-up/email", account)).status,
          200,
          "Synthetic signup succeeds",
        );
        assert.equal(
          await auth.getPrincipal(person.headers()),
          null,
          "Unverified signup has no product principal",
        );
        const message = messages.findLast(
          (mail) =>
            mail.user.email === account.email && mail.kind === "verification",
        );
        assert.ok(message, "Verification callback receives a message");
        const url = new URL(message.url);
        assert.ok(
          [200, 302].includes(
            (
              await person.request(
                url.pathname.replace("/api/auth", "") + url.search,
              )
            ).status,
          ),
          "Verification link succeeds",
        );
        assert.equal(
          (
            await person.request("/sign-in/email", {
              email: account.email,
              password: account.password,
            })
          ).status,
          200,
          "Verified login succeeds",
        );
      }
      const owner = await auth.getPrincipal(first.headers()),
        other = await auth.getPrincipal(second.headers());
      assert.ok(owner);
      assert.ok(other);
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
      assert.equal(
        (
          await first.request("/request-password-reset", {
            email: a.email,
            redirectTo: `${origin}/reset-password`,
          })
        ).status,
        200,
      );
      const recovery = messages.findLast(
        (mail) => mail.kind === "recovery" && mail.user.email === a.email,
      );
      assert.ok(recovery);
      const token = new URL(recovery.url).pathname.split("/").at(-1);
      assert.equal(
        (
          await browser().request("/reset-password", {
            token,
            newPassword: randomUUID() + " new synthetic passphrase",
          })
        ).status,
        200,
      );
      assert.equal(
        await auth.getPrincipal(first.headers()),
        null,
        "Password recovery invalidates old sessions",
      );
      assert.deepEqual(
        await store.read(owner.id),
        reversed,
        "Recovery keeps the same owner's task data",
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
