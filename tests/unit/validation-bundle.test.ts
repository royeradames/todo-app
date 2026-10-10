import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The list page ships its validation to the browser. Full "zod" added about
// 60 KB of mostly unused JavaScript there; "zod/mini" validates the same data
// and, imported as a namespace, lets the bundler drop what the app does not
// use (about 52 KB less gzipped JavaScript on the list page).
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("app code validates with zod/mini, imported as a namespace", () => {
  const offenders = sourceFiles("src").filter((file) => {
    const source = readFileSync(file, "utf8");
    return (
      /from\s+["']zod["']/.test(source) ||
      /import\s*\{[^}]*\}\s*from\s+["']zod\/mini["']/.test(source)
    );
  });
  assert.deepEqual(offenders, []);
});
