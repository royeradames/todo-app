import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deliverAuthMail, readTestMail } from "../../src/lib/mail";

test("synthetic mail exists only in nonproduction loopback mode and never accepts real recipients", async () => {
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
    Object.assign(process.env, {
      AUTH_BASE_URL: "http://localhost:4325",
      AUTH_SECRET: randomUUID() + randomUUID(),
      TODO_LOCAL_TEST_MAIL: "1",
      NODE_ENV: "test",
    });
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    const user = {
      id: randomUUID(),
      name: "Synthetic mail test",
      email: `${randomUUID()}@example.test`,
    };
    await deliverAuthMail("verification", {
      user,
      url: "http://localhost:4325/api/auth/verify-email?token=synthetic-only",
    });
    assert.equal(
      readTestMail(new Request("http://localhost:4325/api/test-mail"))?.some(
        (message) => message.recipient === user.email,
      ),
      true,
    );
    assert.equal(
      readTestMail(new Request("https://todo.example.com/api/test-mail")),
      null,
    );
    await assert.rejects(
      deliverAuthMail("verification", {
        user: { ...user, email: "unrelated@example.invalid" },
        url: "http://localhost:4325/api/auth/verify-email?token=synthetic-only",
      }),
    );
    await assert.rejects(
      deliverAuthMail("verification", {
        user,
        url: "https://untrusted.example/verification",
      }),
    );
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(
      readTestMail(new Request("http://localhost:4325/api/test-mail")),
      null,
    );
    assert.equal(
      readTestMail(new Request("https://todo.example.com/api/test-mail")),
      null,
    );
  } finally {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
