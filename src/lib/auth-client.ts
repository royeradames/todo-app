"use client";
import {
  createPrivateAuthClient,
  createCompanionClient,
} from "@royer/auth/client";
export const authClient = createPrivateAuthClient({});
export const companionClient = createCompanionClient();
export function checkResult(result: { error?: { message?: string } | null }) {
  if (result.error)
    throw new Error(
      result.error.message || "That request could not be completed.",
    );
}
export function returnPath(value: string | null) {
  if (!value) return "/todos";
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}`
      : "/todos";
  } catch {
    return "/todos";
  }
}
