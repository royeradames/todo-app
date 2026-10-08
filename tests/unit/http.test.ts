import assert from "node:assert/strict";
import { test } from "node:test";
import { BadTodoRequest, readTodoMutation } from "../../src/lib/todos/http";
const origin = "http://localhost:4325";
function request(body: string, headers: Record<string, string> = {}) {
  return new Request(origin + "/api/todos", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body,
  });
}
test("HTTP boundary rejects foreign origins, malformed JSON and oversized streamed bodies", async () => {
  for (const [req, status] of [
    [request("{}", { origin: "https://other.invalid" }), 403],
    [request("{"), 400],
    [request("x".repeat(65537)), 413],
  ] satisfies [Request, number][]) {
    await assert.rejects(
      readTodoMutation(req, origin),
      (error) => error instanceof BadTodoRequest && error.status === status,
    );
  }
});
test("valid JSON boundary derives only a version and allowed command", async () => {
  assert.deepEqual(
    await readTodoMutation(
      request(
        JSON.stringify({
          version: 0,
          command: { kind: "add", title: "  Task  " },
        }),
      ),
      origin,
    ),
    { version: 0, command: { kind: "add", title: "Task" } },
  );
});
