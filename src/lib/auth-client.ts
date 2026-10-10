"use client";
import * as z from "zod/mini";
import { safeReturnPath } from "./return-path";

const principalSchema = z.nullable(z.object({ id: z.string() }));

/** Same-origin path only; anything else returns to the saved list. */
export function returnPath(value: string | null) {
  return safeReturnPath(value, window.location.origin);
}

/** The principal this browser's Todo session belongs to, or null. */
export async function currentAccountId(signal?: AbortSignal) {
  const response = await fetch("/api/auth/get-session", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Your account could not be checked.");
  return principalSchema.parse(await response.json())?.id ?? null;
}

/** Starts the central sign-in and returns the issuer address to open. */
export async function startSignIn(returnTo: string | null) {
  const response = await fetch("/api/auth/federation/start", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ returnPath: returnPath(returnTo) }),
  });
  const body = z.object({ url: z.url() }).safeParse(await response.json().catch(() => null));
  if (!response.ok || !body.success)
    throw new Error(
      "Sign-in is temporarily unavailable. Please try again in a moment.",
    );
  const destination = new URL(body.data.url);
  if (destination.protocol !== "https:" && destination.hostname !== "localhost")
    throw new Error("Sign-in is temporarily unavailable.");
  return destination.href;
}

/** Ends this browser's Todo session. The central account stays signed in. */
export async function signOutOfTodo() {
  // The auth endpoints accept JSON bodies only, so send an empty object.
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("Could not finish signing out. Please try again.");
}
