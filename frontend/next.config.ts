import type { NextConfig } from "next";

const getBackendUrl = () => {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  return "http://localhost:3001";
};

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
