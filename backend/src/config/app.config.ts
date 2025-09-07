export const config = {
  app: {
    port: '3001',
    environment: process.env.NODE_ENV || 'development',
  },
  plex: {
    refreshInterval: parseInt(
      process.env.PLEXGUARD_REFRESH_INTERVAL || '10',
      10,
    ),
    stopMessage:
      process.env.PLEXGUARD_STOPMSG ||
      'This device must be approved by the server owner. Please contact the server administrator for more information.',
  },
  cors: {
    origins: '*',
  },
  database: {
    path: process.env.DATABASE_PATH || 'plex-guard.db',
    logging: process.env.NODE_ENV === 'development',
  },
};

export const isDevelopment = () => config.app.environment === 'development';
