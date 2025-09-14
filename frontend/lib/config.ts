export const config = {
  api: {
    baseUrl: "/api/pg",
  },
  app: {
    environment: process.env.NODE_ENV || "development",
    refreshInterval: 3000, // 3 seconds
  },
};
