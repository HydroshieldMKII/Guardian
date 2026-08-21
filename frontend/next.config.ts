import type { NextConfig } from "next";
import { getBackendUrl } from "./lib/config";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/pg/:path*",
          destination: `${getBackendUrl()}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
