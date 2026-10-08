# Todo

Private Frontend Mentor Todo implementation and first isolated `@royer/auth` consumer. Public `/` is a fictional, tab-only demo. `/todos` is each signed-in person's durable list. There is no automatic demo import or shared family account database.

## Current state

Source is being prepared. PostgreSQL migration, all auth journeys, deployment and real email delivery must pass their checks before real accounts are enabled. The account package's original tests used SQLite, so PostgreSQL support is an explicit consumer gate, not an assumed result.

## Local development

Use Node 24.11.1, `npm ci`, then `npm run dev` at `http://localhost:4325`. Credentials belong only in the ignored, mode-0600 `.env.local`. The coordinator supplies the development connection. Never print, commit or copy that file into artifacts.

The pinned private package archive is `vendor/royer-auth-0.1.0-rc.3.tgz`, SHA-256 `b1e672fa2d548289c9601f8849a88338eed7d8341653182e8be427c6e4b10a2e`, the CI-built release of reviewed merge `0db56bf1119af71c88664b585b9235de040d84b8` (https://github.com/royeradames/royer-auth/releases/tag/v0.1.0-rc.3). It replaces defective rc.1. Do not publish this repository or its dependency. Auth handlers stay in the package. The account components adapt its reference client UI.

`AUTH_BASE_URL` must be an exact HTTPS origin, or loopback HTTP for development. `AUTH_SECRET` is unique and at least 32 random characters. Runtime uses the pooled `DATABASE_URL`; migrations use `DATABASE_URL_UNPOOLED`. Production additionally needs `RESEND_API_KEY` and an approved `AUTH_EMAIL_FROM`. Missing account configuration fails closed.

Local synthetic verification requires all three: nonproduction mode, loopback origin and `TODO_LOCAL_TEST_MAIL=1`. Only `@example.test` mail enters its bounded in-memory test mailbox. `/api/test-mail` is 404 outside that mode. It is a test harness, not a recovery route. No code inbox is available in Preview or Production.

## First schema

The only assigned store is the new Free `todo-development-db` (`rough-haze-94222851`), connected to Vercel Development. There is no Preview or Production account store yet.

1. `npm run db:plan` uses the direct connection for metadata and generates `migrations/0001_auth.sql`; it does not apply SQL. Review this and `0002_todos.sql`, plus the combined SHA-256.
2. Only after coordinator review, `npm run db:migrate -- --reviewed-sha256=HASH` initializes the exact empty development store in one transaction with a migration record. It refuses existing public tables and checks the resource identity. It never drops data.
3. Apply schema before new code serves accounts. A failed transaction rolls back. After success, preserve the database; do not run down migrations or roll back to an incompatible auth package. Hosted release needs a provider recovery point and a separate reviewed rollout.

Auth owns credentials, sessions and assurance tables. Todo owns `todo_lists` and `todo_items`, foreign-keyed to immutable text user IDs. Every product request checks the server principal. Every write holds the person's list lock and checks a version; conflicts return 409 and refresh, never silently overwrite. Reorder requires an exact owned-ID permutation; filtered movement preserves hidden items.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`: types, static checks, pure list/body/config regressions.
- `npm run test:integration`: synthetic PostgreSQL package and task ownership/concurrency checks, only after the reviewed development migration.
- `npm run test:browser`: real local account/UI journeys with disposable synthetic records. No real mail or existing records.
- `npm run build`, production dependency audit, then production-mode no-test-mail/auth fail-closed check.

Acceptance includes verification/login/recovery/session invalidation, virtual passkey user verification, true TOTP and one-use backup codes, requester-bound phone approval, per-account persistence, stale-tab conflicts, offline feedback and native keyboard/filter/reorder behavior. Physical biometrics and phone cameras, real mail delivery, backups and hosted abuse controls remain separate release checks.

## Design and operation

Official starter: `frontendmentorio/todo-app` at `ab67102eff4ea8c9aa616038660fc811eb72255d`. Supplied source stills are in `reference/design`, images in `public/images`. The demo is a design exercise with no fake signed-in profile. Theme is the only browser-persisted preference; real tasks belong to the database.

See `docs/security-contract.md` for privacy, routing and assurance boundaries. Keyboard shortcuts adapt the existing Royer UI guard pattern in a small utility; N focuses a new task, ? opens help and Escape closes it. Native controls perform every task without shortcuts or dragging.
