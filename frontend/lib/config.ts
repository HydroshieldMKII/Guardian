export const config = {
  api: {
    baseUrl: "/api/pg",
  },
  app: {
    environment: process.env.NODE_ENV || "development",
    refreshInterval: 5000, // 5 seconds
  },
};
