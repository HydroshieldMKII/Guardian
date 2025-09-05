export const config = {
  app: {
    port: '3001',
    environment: process.env.NODE_ENV || 'development',
  },
  plex: {
    proxyPort: '8080',
    refreshInterval: parseInt(
      process.env.PLEXGUARD_REFRESH_INTERVAL || '10',
      10,
    ),
    stopMessage:
      process.env.PLEXGUARD_STOPMSG ||
      'This device must be approved by the server owner. Please contact the server administrator for more information.',
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
  },
  database: {
    path: 'plex-guard.db',
    logging: process.env.NODE_ENV === 'development',
  },
};

export const isProduction = () => config.app.environment === 'production';
export const isDevelopment = () => config.app.environment === 'development';
