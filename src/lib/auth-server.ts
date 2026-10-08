import "server-only";
import { configureAuth } from "./auth-config";
import { getDatabase } from "./database";
let auth: ReturnType<typeof configureAuth> | undefined;
export function getAuth() {
  return (auth ??= configureAuth(getDatabase()));
}
