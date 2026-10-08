import { test } from "node:test";
import assert from "node:assert/strict";
import { requestTodos, TodoApiError } from "../../src/lib/todos/client";

test("network, timeout and incomplete replies report unconfirmed writes without claiming rollback", async (t) => {
  for (const failure of [
    new TypeError("Failed to fetch"),
    new DOMException("expired", "TimeoutError"),
  ]) {
    t.mock.method(globalThis, "fetch", async () => {
      throw failure;
    });
    await assert.rejects(
      requestTodos("synthetic-owner", {
        version: 0,
        command: { kind: "add", title: "Synthetic task" },
      }),
      (error) =>
        error instanceof TodoApiError &&
        error.status === 0 &&
        error.message ===
          "The save was not confirmed. Refresh your list before trying again.",
    );
    t.mock.restoreAll();
  }
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{", { status: 200 }),
  );
  await assert.rejects(
    requestTodos("synthetic-owner", {
      version: 0,
      command: { kind: "add", title: "Synthetic task" },
    }),
    (error) => error instanceof TodoApiError && error.status === 0,
  );
});

test("a response from another principal is rejected and cancelled reads remain cancellable", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      ownerId: "another-synthetic-owner",
      version: 0,
      items: [],
    }),
  );
  await assert.rejects(
    requestTodos("synthetic-owner"),
    (error) => error instanceof TodoApiError && error.status === 401,
  );
  t.mock.restoreAll();
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, "fetch", async () => {
    throw controller.signal.reason;
  });
  await assert.rejects(
    requestTodos("synthetic-owner", undefined, controller.signal),
    (error) => error === controller.signal.reason,
  );
});
