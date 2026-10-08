import "server-only";
import type { Principal } from "@royer/auth/server";
import { accountMode, configureAuth } from "./auth-config";
import { getDatabase } from "./database";

let auth: ReturnType<typeof configureAuth> | null | undefined;

/**
 * Todo's account handler, or null when this deployment has no working issuer
 * registration. Production has none until a production issuer exists, so it
 * runs browser-only and says accounts are coming soon instead of failing.
 */
export function getAuth() {
  if (auth !== undefined) return auth;
  const mode = accountMode();
  try {
    auth = mode === "on" ? configureAuth(getDatabase()) : null;
  } catch {
    auth = null;
  }
  if (mode === "invalid" || (mode === "on" && !auth))
    console.error(JSON.stringify({ event: "account_settings_invalid" }));
  return auth;
}

export type Viewer =
  | { state: "accounts-off" }
  | { state: "signed-out" }
  | { state: "unavailable" }
  | { state: "signed-in"; principal: Principal };

/**
 * Who is looking at this page. An unreachable issuer or store is a retry
 * state, never a guess that the person is signed in or signed out.
 */
export async function currentViewer(headers: Headers): Promise<Viewer> {
  const accounts = getAuth();
  if (!accounts) return { state: "accounts-off" };
  try {
    const principal = await accounts.getPrincipal(headers);
    return principal
      ? { state: "signed-in", principal }
      : { state: "signed-out" };
  } catch {
    console.error(JSON.stringify({ event: "account_check_failed" }));
    return { state: "unavailable" };
  }
}

export const accountsComingSoon = "Accounts are coming soon.";
