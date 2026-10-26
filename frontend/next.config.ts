import type { NextConfig } from "next";
import { BACKEND_URL } from "./lib/config";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/pg/:path*",
          destination: `${BACKEND_URL}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
