import assert from "node:assert/strict";
import { test } from "node:test";
import { readLocalList, writeLocalList } from "../../src/lib/todos/local";

const task = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Synthetic task",
  completed: false,
};

test("a saved browser list round-trips", () => {
  assert.deepEqual(readLocalList(writeLocalList([task])), [task]);
  assert.deepEqual(readLocalList(writeLocalList([])), []);
});

test("a missing or damaged browser list is ignored, not trusted", () => {
  for (const raw of [
    null,
    "",
    "not json",
    "{}",
    JSON.stringify({ version: 1, items: [{ ...task, id: "not-a-uuid" }] }),
    JSON.stringify({ version: 1, items: [{ ...task, title: "" }] }),
    JSON.stringify({ version: 1, items: [task, task] }),
  ])
    assert.equal(readLocalList(raw), null, String(raw));
});
