export const config = {
  app: {
    port: '3001',
    environment: process.env.NODE_ENV || 'development',
  },
  database: {
    path: process.env.DATABASE_PATH || 'plex-guard.db',
    logging: process.env.NODE_ENV === 'development',
  },
};

export const isDevelopment = () => config.app.environment === 'development';
