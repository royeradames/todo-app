import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Todo serves a real shared account, so what it ships is ours: no image, icon
// or sentence from the Frontend Mentor starter. reference/ keeps the supplied
// design stills for comparison only; it is never served.
const root = join(import.meta.dirname, "..", "..");
const shipped = ["public", "src"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const all = shipped.flatMap((dir) => files(join(root, dir)));

// SHA-256 prefixes of the starter's images folder (todo-app-main/images).
const starterImages: Record<string, string> = {
  cf72eaad92c51941: "bg-desktop-dark.jpg",
  c99caf8950a5e62d: "bg-desktop-light.jpg",
  "0b3e4071b0bb0316": "bg-mobile-dark.jpg",
  df636158d6511a51: "bg-mobile-light.jpg",
  "26a7842c67ba2247": "favicon-32x32.png",
  bcf055e6244effa7: "icon-check.svg",
  "37f00ffb6ee81e15": "icon-cross.svg",
  dadf6d0a5512eddd: "icon-moon.svg",
  fc80f87af0c41afe: "icon-sun.svg",
};

// The starter icons' path data, as it appeared when copied inline, and the
// design's sample tasks and instructions.
const starterText = [
  "M16.97 0l.708.707",
  "M13 0c.81 0 1.603.074",
  "M13 21a1 1 0 011 1v3",
  "/images/bg-",
  "/images/icon-",
  "favicon-32x32",
  "Complete online JavaScript course",
  "Jog around the park 3x",
  "10 minutes meditation",
  "Read for 1 hour",
  "Pick up groceries",
  "Complete Todo App on Frontend Mentor",
  "Create a new todo",
  "Drag and drop to reorder list",
];

test("no shipped file is a Frontend Mentor starter image", () => {
  const copies = all.flatMap((path) => {
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    const name = starterImages[hash.slice(0, 16)];
    return name ? [`${relative(root, path)} is the starter's ${name}`] : [];
  });
  assert.deepEqual(copies, []);
});

test("no shipped source carries the starter's icons, sample tasks or instructions", () => {
  const hits = all
    .filter((path) => /\.(tsx?|css|json|svg)$/.test(path))
    .flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return starterText
        .filter((needle) => text.includes(needle))
        .map((needle) => `${relative(root, path)}: ${needle}`);
    });
  assert.deepEqual(hits, []);
});
