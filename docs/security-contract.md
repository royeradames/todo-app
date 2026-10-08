# Todo foundation contract

App owner owns business permissions, rows, origin and deployments. Royer Auth 0.1.0-rc.3 in central mode delegates credentials, MFA, verification mail and recovery to the Breakthrough issuer; Todo keeps local principals, sessions and the issuer-subject mapping. Only the federated handler and getPrincipal are application interfaces. Engine options are read by migration tooling only. No existing users are migrated.

Runtime uses one pooled pg connection pool with Vercel attachment. Migration planning reads the direct development connection and writes generated SQL for review. Schema application is a separate explicit operation. Never migrate at request startup or build time. No Preview or Production database is configured yet.

The application never accepts an owner ID from the browser. Every stored Todo request validates the principal and queries that ID. Mutations require exact Origin and a bounded parsed command, lock the person's list, compare version, and increment version with the mutation. Reordering accepts an exact permutation of owned IDs, including filtered-out rows. Other accounts cannot read, move or mutate those rows. An outdated list gets a conflict and is reloaded. No saved offline write queue.

Task text can contain private plans. Store only identity reference, title, completed flag and order; never send text or email to logs/analytics. Auth cookies remain host-only and private package tokens never enter Todo state. Browser query state is account-scoped and cleared on logout; the issuer completes verification and enrolled MFA before it returns an authorization code, so an incomplete sign-in never reaches /todos.

Public / is a named demo with fictional data and tab-local changes. /todos is durable per-account storage. Theme alone is a device preference. No demo data is imported into an account.

Todo sends no mail and has no test-mail route; the issuer delivers verification and recovery. Hosted checks use the issuer's token-protected synthetic sink. No copied reference-app database. Missing configuration returns an unavailable error without creating a session.

Canonical future origin: https://todo.royeradames.com. Local origin: http://localhost:4325. Passkeys are enrolled only against the actual configured origin. Do not make preview hosts trusted dynamically. Vercel documents overwriting x-forwarded-for; verify actual ingress on the deployed consumer. Package Postgres concurrency/auth behavior remains a required gate because the package's first tests used SQLite.

Plan: generated schema review, direct development migration under coordinator authority, real PG ownership/concurrency tests, the hosted central journey on the protected previews, dependency/build/type/lint checks, independent review. No real account/mail data or physical biometric claim.

A write also requires the displayed principal in `x-todo-account`. This header is only an equality assertion against the server principal: it can reject a stale screen after another tab changes the cookie, and never chooses ownership or grants access. Missing/mismatched assertions reject before any product mutation.

Package correction: rc.1 had a username extra-field/credential-epoch defect. On October 7 the app moved to the reviewed rc.3 archive and then to central mode. Its schema has no credential tables; `migrations/0001_auth.sql` holds local users/sessions plus `federationTransaction`, `federationIdentity` and `federationGrant`. The registered preview origin is exact; issuer calls carry a per-request Vercel OIDC token for the issuer's Trusted Sources rule, separate from any user token.
