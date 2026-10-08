/**
 * A same-origin path to return to after sign-in, or the saved list.
 * Checks the normalized path: "/.//host" normalizes to "//host".
 */
export function safeReturnPath(value: unknown, origin: string) {
  // A repeated query parameter arrives as an array; only one path is valid.
  if (typeof value !== "string" || !value.startsWith("/")) return "/todos";
  try {
    const url = new URL(value, origin);
    return url.origin === new URL(origin).origin &&
      !url.pathname.startsWith("//") &&
      !url.pathname.includes("\\") &&
      !value.includes("\\")
      ? `${url.pathname}${url.search}`
      : "/todos";
  } catch {
    return "/todos";
  }
}
