export const config = {
  api: {
    baseUrl: "/api/pg",
  },
  app: {
    environment: process.env.NODE_ENV || "development",
    refreshInterval: parseInt(
      process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "5000",
      10
    ),
  },
};
