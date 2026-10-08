import { createFederatedAuth } from "@royer/auth/federation";
import { getVercelOidcToken } from "@vercel/functions/oidc";
import type { Pool } from "pg";

export class AccountUnavailable extends Error {}

const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
const unavailable = "Account access is not configured yet.";

// An exact origin: HTTPS, or HTTP on loopback for local development.
function exactOrigin(value: string | undefined) {
  if (!value) throw new AccountUnavailable(unavailable);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AccountUnavailable(unavailable);
  }
  const loopback = loopbackHosts.includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  )
    throw new AccountUnavailable(
      "Account addresses must be exact HTTPS origins, or local development origins.",
    );
  return url;
}

/**
 * Todo signs in through the central Breakthrough account. Credentials,
 * verification mail, MFA and recovery live on the issuer; Todo keeps only
 * its own principal IDs, sessions and lists.
 */
export function authSettings() {
  const base = exactOrigin(process.env.AUTH_BASE_URL);
  if (base.pathname !== "/") throw new AccountUnavailable(unavailable);
  const secret = process.env.AUTH_SECRET;
  const clientId = process.env.AUTH_CLIENT_ID;
  const clientSecret = process.env.AUTH_CLIENT_SECRET;
  if (!secret || secret.length < 32 || !clientId || !clientSecret)
    throw new AccountUnavailable(unavailable);
  const issuer = exactOrigin(process.env.AUTH_ISSUER_URL);
  if (issuer.pathname !== "/api/auth" || issuer.href !== process.env.AUTH_ISSUER_URL)
    throw new AccountUnavailable(
      "The account issuer must be its exact origin plus /api/auth.",
    );
  return {
    baseURL: base.origin,
    secret,
    issuerURL: issuer.href,
    issuerOrigin: issuer.origin,
    clientId,
    clientSecret,
  };
}

/**
 * The preview issuer sits behind Vercel Deployment Protection. Its Trusted
 * Sources rule admits this project's Preview deployments, which prove
 * themselves with a fresh Vercel OIDC token on every issuer request.
 */
export async function trustedSourceHeaders() {
  const token = await getVercelOidcToken();
  if (!token) throw new AccountUnavailable("Account access is unavailable.");
  return { "x-vercel-trusted-oidc-idp-token": token };
}

export function configureAuth(database: Pool) {
  const settings = authSettings();
  const onVercel = process.env.VERCEL === "1";
  return createFederatedAuth({
    appId: "todo",
    appName: "Todo",
    baseURL: settings.baseURL,
    secret: settings.secret,
    database,
    issuerURL: settings.issuerURL,
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    ...(onVercel
      ? {
          issuerRequestHeaders: trustedSourceHeaders,
          ipAddress: { headers: ["x-vercel-forwarded-for"] },
        }
      : {}),
  });
}
