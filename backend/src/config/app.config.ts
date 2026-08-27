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
    logging: process.env.NODE_ENV === 'development',
  },
};

export const isDevelopment = () => config.app.environment === 'development';

export function appUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}
