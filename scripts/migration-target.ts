// The only databases the reviewed migration scripts may touch, chosen explicitly with
// --target=development (default) or --target=production.
const targets = {
  development: { name: "todo-development-db", neonProject: "rough-haze-94222851", baseURLs: ["http://localhost:4325"] },
  // Production keeps accounts off until an issuer registration exists, so AUTH_BASE_URL may be unset.
  production: { name: "todo-production-db", neonProject: "sparkling-art-68750785", baseURLs: ["", "https://todo-app.royeradames.com"] },
} as const;

/** URL errors would echo the connection string; read the hostname without them. */
function directHost(value: string | undefined) {
  try { return value ? !new URL(value).hostname.includes("-pooler") : false; } catch { return false; }
}

export function migrationTarget(argv: string[], env: NodeJS.ProcessEnv = process.env) {
  const chosen = argv.find((value) => value.startsWith("--target="))?.split("=")[1] ?? "development";
  if (chosen !== "development" && chosen !== "production") throw new Error("Choose --target=development or --target=production.");
  const target = targets[chosen];
  const connectionString = env.DATABASE_URL_UNPOOLED;
  if (env.NEON_PROJECT_ID !== target.neonProject || !directHost(connectionString) ||
      !(target.baseURLs as readonly string[]).includes(env.AUTH_BASE_URL ?? "")) {
    throw new Error(`Migration target must be the assigned direct ${chosen} database.`);
  }
  return { name: target.name, connectionString: connectionString! };
}
