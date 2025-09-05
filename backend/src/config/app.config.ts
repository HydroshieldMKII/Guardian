export const config = {
  app: {
    port: process.env.PLEXGUARD_API_PORT || '3001',
    environment: process.env.NODE_ENV || 'development',
  },
  plex: {
    proxyPort: process.env.PLEXGUARD_PROXY_PORT || '8080',
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
    path: 'plex-guard.db',
    logging: process.env.NODE_ENV === 'development',
  },
};

export const isProduction = () => config.app.environment === 'production';
export const isDevelopment = () => config.app.environment === 'development';
