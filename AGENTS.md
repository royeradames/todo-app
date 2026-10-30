<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Styling: Tailwind first

Royer, Oct 28, 2026: "I was expecting us to use default tailwind classes for the most part and for us to have a justification and log it when we don't."

- Layout, spacing, sizing, colour tokens and type use Tailwind utilities. Write custom CSS only where Tailwind can't express it, and give each such rule a `/* why: ... */` comment.
- Build dynamic class names with `cn()` (clsx + tailwind-merge), never string concatenation or template literals, so conflicting utilities resolve and unused ones stay out. This repo has no cn() yet; add it at src/lib/utils.ts (clsx + tailwind-merge) in the first PR that needs a dynamic class.

## Checks and installs

- Bun 1.4.4 is the package manager (`bun install --frozen-lockfile`); commit `bun.lock`. Node 24.11.1 remains the runtime for Next.js and the node:test suite.
- Merges run change-scoped checks from `.affected-checks.json` (royer-merge's affected-checks.mjs). Checks marked `"boat": true` (typecheck, lint, build and the Playwright specs) run on a boat box through run-checks.mjs. Call tools as `./node_modules/.bin/<tool>`.
