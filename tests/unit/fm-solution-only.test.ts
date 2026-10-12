import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

// This repository is my public Frontend Mentor solution: a browser-only list.
// Sign-in and the saved list live in a separate private suite app.
// Run from the repository root, as `npm test` does.
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const setup = JSON.parse(readFileSync("setup.json", "utf8"));

test("the solution installs no @royer/auth package", () => {
  assert.equal(pkg.dependencies?.["@royer/auth"], undefined);
  assert.equal(pkg.devDependencies?.["@royer/auth"], undefined);
  assert.equal(lock.packages?.["node_modules/@royer/auth"], undefined);
});

test("the solution keeps no vendored package archive", () => {
  const archives = existsSync("vendor")
    ? readdirSync("vendor").filter((name) => name.endsWith(".tgz"))
    : [];
  assert.deepEqual(archives, []);
});

test("setup.json lists no account or database settings", () => {
  const names: string[] = (setup.env ?? []).map((entry: { key: string }) => entry.key);
  assert.deepEqual(names.filter((name) => /^(AUTH_|DATABASE_)/.test(name)), []);
});
