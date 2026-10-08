import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
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
