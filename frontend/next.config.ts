import type { NextConfig } from "next";

function getBackendUrl(): string {
  return process.env.DEPLOYMENT_MODE === "standalone"
    ? "http://localhost:3001"
    : "http://backend:3001";
}

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: false,
  async rewrites() {
    const backendUrl = getBackendUrl();
    return {
      beforeFiles: [
        {
          source: "/api/pg/:path*",
          destination: `${backendUrl}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
