export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 
             process.env.NEXT_PUBLIC_API_URL || 
             `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || '3001'}`,
  },
  app: {
    environment: process.env.NODE_ENV || "development",
    refreshInterval: parseInt(
      process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "5000",
      10
    ),
  },
};

export const isProduction = () => config.app.environment === "production";
export const isDevelopment = () => config.app.environment === "development";
