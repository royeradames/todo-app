import { test } from "node:test";
import assert from "node:assert/strict";
import { authSettings, AccountUnavailable } from "../../src/lib/auth-config";

const names = [
  "AUTH_BASE_URL",
  "AUTH_SECRET",
  "AUTH_ISSUER_URL",
  "AUTH_CLIENT_ID",
  "AUTH_CLIENT_SECRET",
];
function withEnvironment(run: () => void) {
  const before = new Map(names.map((name) => [name, process.env[name]]));
  try {
    process.env.AUTH_BASE_URL = "https://todo.example.com";
    process.env.AUTH_SECRET = "synthetic-test-configuration-only-32-characters";
    process.env.AUTH_ISSUER_URL = "https://accounts.example.com/api/auth";
    process.env.AUTH_CLIENT_ID = "synthetic-client";
    process.env.AUTH_CLIENT_SECRET = "synthetic-client-secret";
    run();
  } finally {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("central sign-in requires exact app and issuer origins", () =>
  withEnvironment(() => {
    const settings = authSettings();
    assert.equal(settings.baseURL, "https://todo.example.com");
    assert.equal(settings.issuerURL, "https://accounts.example.com/api/auth");
    assert.equal(settings.issuerOrigin, "https://accounts.example.com");
    for (const invalid of [
      "http://todo.example.com",
      "https://todo.example.com/path",
      "https://user:password@todo.example.com",
      "https://todo.example.com?x=1",
      "https://todo.example.com#fragment",
    ]) {
      process.env.AUTH_BASE_URL = invalid;
      assert.throws(authSettings, AccountUnavailable, invalid);
    }
    process.env.AUTH_BASE_URL = "http://localhost:4325";
    assert.equal(authSettings().baseURL, "http://localhost:4325");
    for (const invalid of [
      "http://accounts.example.com/api/auth",
      "https://accounts.example.com",
      "https://accounts.example.com/api/auth/",
      "https://accounts.example.com/other",
      "https://accounts.example.com/api/auth?x=1",
    ]) {
      process.env.AUTH_ISSUER_URL = invalid;
      assert.throws(authSettings, AccountUnavailable, invalid);
    }
  }));

test("missing or weak secrets and client registration fail closed", () =>
  withEnvironment(() => {
    for (const name of names) {
      const value = process.env[name];
      delete process.env[name];
      assert.throws(authSettings, AccountUnavailable, name);
      process.env[name] = value;
    }
    process.env.AUTH_SECRET = "too-short";
    assert.throws(authSettings, AccountUnavailable);
  }));
