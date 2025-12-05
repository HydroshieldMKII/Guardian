export const config = {
  app: {
    port: '3001',
    environment: process.env.NODE_ENV || 'development',
  },
  api: {
    baseUrl: '/api/pg',
  },
  database: {
    path: process.env.DATABASE_PATH || 'plex-guard.db',
    logging:
      process.env.DB_LOGGING !== undefined
        ? process.env.DB_LOGGING === 'true'
        : process.env.NODE_ENV === 'development',
  },
};

export const isDevelopment = () => config.app.environment === 'development';
