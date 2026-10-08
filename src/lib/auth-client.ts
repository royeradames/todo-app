"use client";
import { z } from "zod";

const principalSchema = z
  .object({ id: z.string() })
  .nullable();

/** Same-origin path only; anything else returns to the saved list. */
export function returnPath(value: string | null) {
  if (!value) return "/todos";
  try {
    const url = new URL(value, window.location.origin);
    // Check the normalized path: "/.//host" normalizes to "//host".
    return url.origin === window.location.origin &&
      !url.pathname.startsWith("//") &&
      !url.pathname.includes("\\")
      ? `${url.pathname}${url.search}`
      : "/todos";
  } catch {
    return "/todos";
  }
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
