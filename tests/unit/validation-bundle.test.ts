import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The list page ships its validation to the browser. Full "zod" added about
// 60 KB of mostly unused JavaScript there; "zod/mini" validates the same data
// and lets the bundler drop what the app does not use.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("app code validates with zod/mini, not the full zod build", () => {
  const offenders = sourceFiles("src").filter((file) =>
    /from\s+["']zod["']/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, []);
});
