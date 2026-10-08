import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCommand,
  moveVisible,
  commandSchema,
  visibleTodos,
} from "../../src/lib/todos/model";
const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];
const items = ids.map((id, index) => ({
  id,
  title: `Task ${index}`,
  completed: index === 1,
}));
test("filtered movement preserves the hidden task slot", () => {
  const order = moveVisible(items, "active", ids[2], ids[0]);
  assert.deepEqual(order, [ids[2], ids[1], ids[0]]);
  assert.deepEqual(
    applyCommand(items, { kind: "reorder", ids: order }, () => "unused").map(
      (item) => item.id,
    ),
    order,
  );
  assert.equal(visibleTodos(items, "completed").length, 1);
});
test("reorder rejects duplicates, missing tasks and foreign IDs without mutating the list", () => {
  const before = structuredClone(items);
  for (const invalid of [
    [ids[0], ids[0], ids[2]],
    [ids[0], ids[2]],
    [ids[0], ids[1], "00000000-0000-4000-8000-000000000099"],
  ])
    assert.throws(() =>
      applyCommand(items, { kind: "reorder", ids: invalid }, () => "unused"),
    );
  assert.deepEqual(items, before);
});
test("completion, removal and clearing preserve unrelated tasks", () => {
  const updated = applyCommand(
    items,
    { kind: "complete", id: ids[0], completed: true },
    () => "unused",
  );
  assert.equal(updated[2].completed, false);
  assert.deepEqual(
    applyCommand(updated, { kind: "clear-completed" }, () => "unused").map(
      (item) => item.id,
    ),
    [ids[2]],
  );
  assert.throws(() =>
    applyCommand(items, { kind: "remove", id: "missing" }, () => "unused"),
  );
});
test("commands reject owner injection, blank/long task labels and oversized lists", () => {
  assert.equal(
    commandSchema.safeParse({ kind: "add", title: "   " }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({ kind: "add", title: "x".repeat(501) }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({ kind: "add", title: "Task", ownerId: "other" })
      .success,
    false,
  );
  const full = Array.from({ length: 500 }, () => items[0]);
  assert.throws(() =>
    applyCommand(full, { kind: "add", title: "One too many" }, () => ids[2]),
  );
});
