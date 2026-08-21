function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3001";
}

export const config = {
  api: {
    baseUrl: "/api/pg",
    backendUrl: getBackendUrl(),
  },
  app: {
    environment: process.env.NODE_ENV || "development",
    refreshInterval: 3000, // 3 seconds
  },
};

export { getBackendUrl };
