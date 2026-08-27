import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

const MINUTE_MS = 60 * 1000;

function limiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { statusCode: 429, message: options.message },
  });
}

export const credentialsLimiter = (): RateLimitRequestHandler =>
  limiter({
    windowMs: 15 * MINUTE_MS,
    limit: 10,
    skipSuccessfulRequests: true,
    message: 'Too many failed attempts. Try again in a few minutes.',
  });

export const authLimiter = (): RateLimitRequestHandler =>
  limiter({
    windowMs: MINUTE_MS,
    limit: 300,
    message: 'Too many authentication requests. Try again shortly.',
  });

export const apiLimiter = (): RateLimitRequestHandler =>
  limiter({
    windowMs: MINUTE_MS,
    limit: 1200,
    message: 'Too many requests. Try again shortly.',
  });

export function trustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS?.trim();
  if (!raw) {
    return 1;
  }

  const configured = Number(raw);
  return Number.isInteger(configured) && configured >= 0 ? configured : 1;
}
