"use client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { AuthForm } from "./form";
import { authClient, checkResult } from "@/lib/auth-client";
export function CreateAccount() {
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div className="stack">
        <span className="status-pill">One more step</span>
        <h2>Check your email</h2>
        <p className="card-description">
          Open the verification link to activate your account. Then return here
          to sign in.
        </p>
        <Link className="text-link" href="/login">
          Return to sign in
        </Link>
      </div>
    );
  return (
    <>
      <h2>Create your account</h2>
      <p className="card-description">
        Start with a password. Add a passkey or an authenticator app after
        signing in.
      </p>
      <AuthForm
        fields={[
          { name: "name", label: "Name", autoComplete: "name" },
          {
            name: "username",
            label: "Username",
            autoComplete: "username",
            hint: "3 to 30 characters. Letters, numbers, underscores and dots.",
          },
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            hint: "Use at least 15 characters. A memorable phrase works well.",
          },
        ]}
        schema={z.object({
          name: z.string().trim().min(1, "Enter your name."),
          username: z
            .string()
            .min(3, "Use at least 3 characters.")
            .max(30, "Use no more than 30 characters.")
            .regex(
              /^[a-zA-Z0-9_.]+$/,
              "Use letters, numbers, underscores and dots.",
            ),
          email: z.string().email("Enter a valid email."),
          password: z
            .string()
            .min(15, "Use at least 15 characters.")
            .max(128, "Use no more than 128 characters."),
        })}
        submit="Create account"
        onSubmit={async ({ name, username, email, password }) => {
          checkResult(
            await authClient.signUp.email({
              name,
              username,
              email,
              password,
              callbackURL: "/login",
            }),
          );
          setSent(true);
        }}
      />
      <div className="form-footer">
        <p>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </>
  );
}
