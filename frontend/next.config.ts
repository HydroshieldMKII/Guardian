import type { NextConfig } from "next";
import { getBackendUrl } from './lib/config';

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
