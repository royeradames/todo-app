import { test } from "node:test";
import assert from "node:assert/strict";
import { authSettings, AccountUnavailable } from "../../src/lib/auth-config";

test("auth config requires an exact origin and keeps the local mailbox out of production", () => {
  const names = [
    "AUTH_BASE_URL",
    "AUTH_SECRET",
    "TODO_LOCAL_TEST_MAIL",
    "NODE_ENV",
    "RESEND_API_KEY",
    "AUTH_EMAIL_FROM",
  ];
  const before = new Map(names.map((name) => [name, process.env[name]]));
  try {
    process.env.AUTH_SECRET = "synthetic-test-configuration-only-32-characters";
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.TODO_LOCAL_TEST_MAIL = "1";
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    for (const invalid of [
      "http://todo.example.com",
      "https://todo.example.com/path",
      "https://user:password@todo.example.com",
      "https://todo.example.com?x=1",
      "https://todo.example.com#fragment",
    ]) {
      process.env.AUTH_BASE_URL = invalid;
      assert.throws(authSettings, AccountUnavailable);
    }
    process.env.AUTH_BASE_URL = "http://localhost:4325";
    assert.equal(authSettings().testMail, true);
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.throws(authSettings, AccountUnavailable);
    process.env.RESEND_API_KEY = "synthetic-not-a-real-provider-key";
    process.env.AUTH_EMAIL_FROM = "Todo <test@example.invalid>";
    assert.equal(authSettings().testMail, false);
  } finally {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
