import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const configuredApiUrl =
  process.env.API_PROXY_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:4000";
const apiProxyOrigin = configuredApiUrl
  .replace(/\/api\/v1\/?$/, "")
  .replace(/\/$/, "");
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: workspaceRoot },
  env: {
    // Browser requests stay on the web origin so auth cookies are first-party.
    NEXT_PUBLIC_API_URL: "/api/v1",
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyOrigin}/api/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};
export default nextConfig;
