import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Vercel restores .next/cache between deployments. With Turbopack's build
  // cache on, the October 8 production build reused the previous stylesheet
  // and shipped the old CSS with the new markup (the add-task circle had no
  // size). Builds are small, so always compile from source.
  experimental: { turbopackFileSystemCacheForBuild: false },
  logging: { incomingRequests: false },
  serverExternalPackages: ["pg"],
  outputFileTracingExcludes: {
    "/*": [".env*", ".test-state/**", "reference/**", "tests/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
