export const BACKEND_URL = "http://localhost:3001";

export const config = {
  api: {
    baseUrl: "/api/pg",
    backendUrl: BACKEND_URL,
  },
  app: {
    environment: process.env.NODE_ENV || "development",
    refreshInterval: 3000, // 3 seconds
  },
};
