import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath } from "../../src/lib/return-path";

test("return paths stay on this origin", () => {
  const origin = "https://todo.example.com";
  assert.equal(safeReturnPath("/account", origin), "/account");
  assert.equal(safeReturnPath("/todos?filter=active", origin), "/todos?filter=active");
  for (const unsafe of [
    null,
    undefined,
    "",
    "https://evil.example/todos",
    "//evil.example",
    "/.//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
  ])
    assert.equal(safeReturnPath(unsafe, origin), "/todos", String(unsafe));
});
