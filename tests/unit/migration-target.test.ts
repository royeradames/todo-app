import assert from "node:assert/strict";
import { test } from "node:test";
import { migrationTarget } from "../../scripts/migration-target";

const direct = "postgresql://user:pw@ep-example.us-east-1.aws.neon.tech/db";
const pooled = "postgresql://user:pw@ep-example-pooler.us-east-1.aws.neon.tech/db";

test("migrations reach only the named development or production store", () => {
  const dev = { NEON_PROJECT_ID: "rough-haze-94222851", DATABASE_URL_UNPOOLED: direct, AUTH_BASE_URL: "http://localhost:4325" };
  assert.equal(migrationTarget([], dev).name, "todo-development-db");
  const prod = { NEON_PROJECT_ID: "sparkling-art-68750785", DATABASE_URL_UNPOOLED: direct };
  assert.equal(migrationTarget(["--target=production"], prod).name, "todo-production-db");
  assert.equal(migrationTarget(["--target=production"], { ...prod, AUTH_BASE_URL: "https://todo-app.royeradames.com" }).name, "todo-production-db");
  // The development database never passes as production, and the reverse.
  assert.throws(() => migrationTarget(["--target=production"], dev));
  assert.throws(() => migrationTarget([], prod));
  assert.throws(() => migrationTarget(["--target=staging"], dev));
  assert.throws(() => migrationTarget(["--target=production"], { ...prod, DATABASE_URL_UNPOOLED: pooled }), /direct production/);
  assert.throws(() => migrationTarget(["--target=production"], { ...prod, AUTH_BASE_URL: "http://localhost:4325" }));
});

test("a malformed connection string fails without echoing it", () => {
  const secretish = "not a url but-a-secret-value";
  assert.throws(
    () => migrationTarget(["--target=production"], { NEON_PROJECT_ID: "sparkling-art-68750785", DATABASE_URL_UNPOOLED: secretish }),
    (error: Error) => !error.message.includes(secretish),
  );
});
