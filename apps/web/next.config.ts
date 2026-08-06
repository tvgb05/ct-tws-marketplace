import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: workspaceRoot },
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
};
export default nextConfig;
