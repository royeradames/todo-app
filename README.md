# Todo

Private Frontend Mentor Todo implementation and the first central-mode `@royer/auth` consumer. Public `/` is a fictional, tab-only demo. `/todos` is each signed-in person's durable list. There is no automatic demo import or shared family account database.

## Accounts

Todo signs in through the central **Breakthrough account** (`@royer/auth` 0.1.0-rc.4, central mode). The issuer owns passwords, passkeys, authenticator codes, phone approval, verification mail and recovery. Todo owns only its local principals, sessions and lists. It never sees a password and sends no mail.

- `/login` starts the sign-in at `POST /api/auth/federation/start`; the issuer returns the browser to `/api/auth/federation/callback`, then to the saved list.
- Every protected read and write calls `getPrincipal`, which re-checks the live central session. Signing out of the issuer ends Todo's session on its next read.
- "Sign out of Todo" ends Todo on this browser only. The central account stays signed in, so "Continue" returns without another password.
- An unreachable issuer is a retry state (503), never a signed-out or signed-in guess.

The pinned private package archive is `vendor/royer-auth-0.1.0-rc.4.tgz`, SHA-256 `22e5e9d13d4ee67bdd51f12f21043de59d3016ea6b1b1d2d3d1289a1226348d8`, the CI-built release of reviewed merge `a326496c221ab6a3ec81a2afc97099fee4e73702` (https://github.com/royeradames/royer-auth/releases/tag/v0.1.0-rc.4). This repository is private, so it keeps the archive instead of using the registry.

## Configuration

| Variable | Meaning |
| --- | --- |
| `AUTH_BASE_URL` | Todo's exact HTTPS origin (loopback HTTP for development). Requests from any other host are refused. |
| `AUTH_SECRET` | Todo's own random secret, at least 32 characters. |
| `AUTH_ISSUER_URL` | The issuer's exact origin plus `/api/auth`, today `https://accounts-preview.royeradames.com/api/auth`. |
| `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET` | Issued once by the issuer operator for Todo's exact callback and sign-out addresses. |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Pooled runtime and direct migration connections. |

Missing configuration fails closed. On Vercel, each issuer request carries a fresh Vercel OIDC token in `x-vercel-trusted-oidc-idp-token`, which the protected issuer admits through its **Trusted Sources** rule for this project's Preview deployments. Credentials live only in Vercel and `.env.local`; never print or commit them.

**Preview.** The protected Preview of `feat/todo-auth-foundation` is registered at `https://todo-app-git-feat-todo-auth-foundation-royer-adames-projects.vercel.app`; its settings are scoped to that branch. A different stable origin needs its own client registration. The issuer refuses Vercel Production, so Todo Production has no account settings and its account routes fail closed until a production issuer exists.

## Database

`todo-development-db` (`rough-haze-94222851`) serves Development and Preview. `npm run db:plan` generates `migrations/0001_auth.sql` from the central-mode configuration without applying it. `npm run db:migrate -- --reviewed-sha256=HASH` initializes only that exact empty store in one transaction and records the migration. It never drops data. Applied October 7, 2026: combined SHA-256 `e9c155bb4859325ad8b6b925ed38182e2df0d7a39e8e401018af26520076f35d`.

Todo owns `todo_lists` and `todo_items`, foreign-keyed to immutable local user IDs. A durable unique issuer-and-subject mapping creates each local principal; email is never a linking key. Every write holds the person's list lock and checks a version; conflicts return 409 and refresh. Reorder requires an exact owned-ID permutation.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`: types, static checks, list/HTTP/configuration regressions.
- `npm run test:integration` with `TODO_RUN_DATABASE_TESTS=1`: real PostgreSQL ownership, concurrency and cascade checks in a disposable schema.
- `npm run test:browser`: the public demo, keyboard and narrow screens (`TODO_TEST_PORT` overrides 4325).
- `npm run build`, then `node scripts/verify-production-boundary.mjs`: unconfigured accounts and data fail closed.
- `npm run test:browser`: also covers an unreachable issuer and store (sign-in alert, retry page, callback page instead of JSON) and a crafted return path, using closed local ports.
- `npm run test:hosted`: the real central journey on the protected previews with synthetic `@sink.accounts-preview.test` accounts: sign-in, saved list, 409 refresh across tabs, another account's isolation, sign-out in another tab, expired callback, 400px pages, local and central sign-out. The **Hosted Todo journey** workflow runs it after each Preview deploy of the registered branch, then `scripts/cleanup-hosted-accounts.mjs` removes every `todo-suite-` account from both databases. Its secrets live only on the branch-limited `hosted-preview` GitHub environment.

## Design and operation

Official starter: `frontendmentorio/todo-app` at `ab67102eff4ea8c9aa616038660fc811eb72255d`. Supplied source stills are in `reference/design`, images in `public/images`. The demo is a design exercise with no fake signed-in profile. Theme is the only browser-persisted preference; real tasks belong to the database.

See `docs/security-contract.md` for privacy, routing and assurance boundaries. Keyboard shortcuts adapt the existing Royer UI guard pattern in a small utility; N focuses a new task, ? opens help and Escape closes it. Native controls perform every task without shortcuts or dragging.
