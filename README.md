# Todo

Private Frontend Mentor Todo implementation and the first central-mode `@royer/auth` consumer. Public `/` is a list saved only in this browser (localStorage), starting from the design's sample tasks. `/todos` is each signed-in person's durable list. The browser list is never imported into an account, and there is no shared family account database.

## Accounts

Todo signs in through the central **Breakthrough account** (`@royer/auth` 0.1.0-rc.5, central mode). The issuer owns passwords, passkeys, authenticator codes, phone approval, verification mail and recovery. Todo owns only its local principals, sessions and lists. It never sees a password and sends no mail.

- `/login` starts the sign-in at `POST /api/auth/federation/start`; the issuer returns the browser to `/api/auth/federation/callback`, then to the saved list.
- Every protected read and write calls `getPrincipal`, which re-checks the live central session. Signing out of the issuer ends Todo's session on its next read.
- "Sign out of Todo" ends Todo on this browser only. The central account stays signed in, so "Continue" returns without another password.
- An unreachable issuer is a retry state (503), never a signed-out or signed-in guess.

The pinned private package archive is `vendor/royer-auth-0.1.0-rc.5.tgz`, SHA-256 `7a4cc4eb5c67446aa6145d94002ed8b111aa90a9228eb2ba60577a7df53ff730`, the CI-built release of reviewed merge `6c7066d64047011a9291bfa3b95ebab25e172bdf` (https://github.com/royeradames/royer-auth/releases/tag/v0.1.0-rc.5). rc.5 makes a doubled sign-in callback land signed in instead of on the expired page; it needs the `0003_rc5_federation` upgrade below. This repository is private, so it keeps the archive instead of using the registry.

## Configuration

| Variable | Meaning |
| --- | --- |
| `AUTH_BASE_URL` | Todo's exact HTTPS origin (loopback HTTP for development). Requests from any other host are refused. |
| `AUTH_SECRET` | Todo's own random secret, at least 32 characters. |
| `AUTH_ISSUER_URL` | The issuer's exact origin plus `/api/auth`, today `https://accounts-preview.royeradames.com/api/auth`. |
| `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET` | Issued once by the issuer operator for Todo's exact callback and sign-out addresses. |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Pooled runtime and direct migration connections. |

`setup.json` lists every setting with why it exists and who sets it. `npm test` checks it covers every setting the code reads (`npm run test:setup`), and the `royer-setup` doctor (`setup-doctor.mjs check setup.json --target production`) checks it against live Vercel settings without reading values. Missing configuration turns accounts off. On Vercel Preview, each issuer request carries a fresh Vercel OIDC token in `x-vercel-trusted-oidc-idp-token`, which the protected issuer admits through its **Trusted Sources** rule for this project's Preview deployments. Credentials live only in Vercel and `.env.local`; never print or commit them.

**Preview.** The protected Preview of `feat/todo-account-journeys` is registered at `https://todo-app-git-feat-todo-account-journeys-royer-adames-projects.vercel.app`; its settings are scoped to that branch. A different branch needs its own registration, which needs no human step: from a `royer-auth` checkout, `node scripts/connect-app.mjs --project todo-app --branch <branch> --name "Todo (preview, <branch>)"` registers the branch's Preview on the preview issuer, writes its settings Sensitive without printing them, allows it through Trusted Sources and redeploys. Then point the `TODO_PREVIEW_BRANCH` and `TODO_PREVIEW_URL` repository variables, and the `hosted-preview` environment's branch rule, at that branch.

**Accounts off.** With no issuer registration (`AUTH_ISSUER_URL`, `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` all empty), accounts are off. That is Production today, because the issuer refuses Vercel Production and no production issuer exists yet. `/` keeps working in this browser and says "Accounts are coming soon"; `/todos` and `/account` redirect to `/login`, which explains the same; the account and list APIs answer 404 "coming soon". Partial or invalid settings log `account_settings_invalid` and also run with accounts off, so a broken setting never turns pages into errors. Other branch previews have no registration either, so they behave like Production.

**Turning accounts on in Production.** No code change is needed; it is only Vercel Production settings, then a redeploy:

1. Register Todo on the production issuer with callback `https://todo-app.royeradames.com/api/auth/federation/callback` and sign-out address `https://todo-app.royeradames.com/account`.
2. Set `AUTH_BASE_URL=https://todo-app.royeradames.com`, `AUTH_ISSUER_URL=https://accounts.royeradames.com/api/auth`, the issued `AUTH_CLIENT_ID` and sensitive `AUTH_CLIENT_SECRET`, and a fresh sensitive `AUTH_SECRET`.
3. Attach a Production database as `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, and apply the reviewed migrations to it with `npm run db:migrate`.

Until all of these exist, Production keeps saying accounts are coming soon. Only Preview deployments send the Vercel OIDC token that the protected preview issuer's Trusted Sources rule needs; Production sends none to the public issuer.

## Database

`todo-development-db` (`rough-haze-94222851`) serves Development and Preview. `npm run db:plan` generates `migrations/0001_auth.sql` from the central-mode configuration without applying it. `npm run db:migrate -- --reviewed-sha256=HASH` initializes only that exact empty store in one transaction and records the migration. It never drops data. Applied October 7, 2026: combined SHA-256 `e9c155bb4859325ad8b6b925ed38182e2df0d7a39e8e401018af26520076f35d`. Later additive upgrades live in `migrations/NNNN_name.sql`; `npm run db:upgrade -- NNNN_name --reviewed-sha256=HASH` applies one once and records it. `0003_rc5_federation` (SHA-256 `960058fbda45e9782241d67018b50189410f8857f8be5766d7723a39ff18fd72`) adds `federationTransaction.completedSessionId` and `claims` for rc.5; apply it before deploying rc.5. Both scripts take `--target=development` (default) or `--target=production`; each target is pinned to its own Neon project. `todo-production-db` (`sparkling-art-68750785`) is a separate free store connected to Production only; it holds the foundation and `0003_rc5_federation` so accounts can open later with only the issuer registration and mail key. Until then Production has no issuer settings and stays in browser-only mode.

Todo owns `todo_lists` and `todo_items`, foreign-keyed to immutable local user IDs. A durable unique issuer-and-subject mapping creates each local principal; email is never a linking key. Every write holds the person's list lock and checks a version; conflicts return 409 and refresh. Reorder requires an exact owned-ID permutation.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`: types, static checks, list/HTTP/configuration regressions.
- `npm run test:integration` with `TODO_RUN_DATABASE_TESTS=1`: real PostgreSQL ownership, concurrency and cascade checks in a disposable schema.
- `npm run test:browser`: the browser list with accounts on, keyboard and narrow screens (`TODO_TEST_PORT` overrides 4325).
- `npm run build`, then `npm run test:production`: the production build with no issuer, registration or database. Account routes never 500 and say accounts are coming soon, the APIs answer 404 without cookies, and the whole browser-list journey works (add, complete, filter, delete, clear, mouse and keyboard reordering, reload, theme) with no console errors (`TODO_PRODUCTION_TEST_PORT` overrides 4327).
- `npm run test:browser`: also covers an unreachable issuer and store (sign-in alert, retry page, callback page instead of JSON) and a crafted return path, using closed local ports.
- `npm run test:hosted`: the real central journeys on the protected previews with synthetic `@sink.accounts-preview.test` accounts. `journeys.spec.ts` clicks every way in and out from Todo's own pages: sign-up from the home page (busy sign-in button, issuer sign-up, emailed verification, back to the list), signing out of Todo and then of the Breakthrough account, and signing in with each option the account offers: password from a new browser (with its emailed browser code), emailed sign-in code, passkey (virtual authenticator), phone approval from a scanned QR, and password plus authenticator code. `central.spec.ts` covers the saved list, 409 refresh across tabs, another account's isolation, sign-out in another tab, expired and doubled callbacks and 400px pages. Each run removes its issuer accounts itself. The **Hosted Todo journey** workflow runs both on the self-hosted Mac after each Preview deploy of the registered branch, then `scripts/cleanup-hosted-accounts.mjs` removes every `todo-suite-` account from both databases. Its secrets live only on the branch-limited `hosted-preview` GitHub environment.

## Design and operation

Official starter: `frontendmentorio/todo-app` at `ab67102eff4ea8c9aa616038660fc811eb72255d`. Supplied source stills are in `reference/design`, images in `public/images`. Layout, spacing, icons, check circles, hover-revealed delete and the separate mobile filter card follow the official design. Two deliberate deviations: text is at least 16px (the design uses 12–14px), and muted, completed and accent colours are adjusted just enough to reach 4.5:1 contrast.

See `docs/security-contract.md` for privacy, routing and assurance boundaries. Keyboard shortcuts adapt the existing Royer UI guard pattern in a small utility; N focuses a new task, ? opens help and Escape closes it. Drag a task with the mouse, or long-press and drag on touch. Alt with the up or down arrow moves the focused task and keeps focus on it, and "Reorder with buttons" shows move buttons for a single-pointer alternative.
