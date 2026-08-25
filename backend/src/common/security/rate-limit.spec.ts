import {
  apiLimiter,
  authLimiter,
  credentialsLimiter,
  trustProxyHops,
} from '@/common/security/rate-limit';

const mockRateLimit = jest.fn();

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: (options: unknown) => mockRateLimit(options),
}));

type LimiterOptions = {
  windowMs: number;
  limit: number;
  skipSuccessfulRequests: boolean;
  standardHeaders: string;
  legacyHeaders: boolean;
  message: { statusCode: number; message: string };
};

const optionsOf = (build: () => unknown): LimiterOptions => {
  mockRateLimit.mockClear();
  build();
  return mockRateLimit.mock.calls[0][0] as LimiterOptions;
};

describe('credentialsLimiter', () => {
  it('allows 20 failed attempts per quarter hour', () => {
    const options = optionsOf(credentialsLimiter);
    expect(options.windowMs).toBe(15 * 60 * 1000);
    expect(options.limit).toBe(20);
  });

  it('does not spend budget on successful sign-ins', () => {
    expect(optionsOf(credentialsLimiter).skipSuccessfulRequests).toBe(true);
  });

  it('is stricter than the general auth limiter', () => {
    const credentials = optionsOf(credentialsLimiter);
    const auth = optionsOf(authLimiter);
    expect(credentials.limit / credentials.windowMs).toBeLessThan(
      auth.limit / auth.windowMs,
    );
  });
});

describe('authLimiter', () => {
  it('counts every request, not just the failures', () => {
    expect(optionsOf(authLimiter).skipSuccessfulRequests).toBe(false);
  });

  it('is stricter than the blanket api limiter', () => {
    expect(optionsOf(authLimiter).limit).toBeLessThan(
      optionsOf(apiLimiter).limit,
    );
  });
});

describe('apiLimiter', () => {
  it('leaves headroom for the dashboard poll loop', () => {
    const options = optionsOf(apiLimiter);
    expect(options.windowMs).toBe(60 * 1000);
    expect(options.limit).toBeGreaterThanOrEqual(1000);
  });
});

describe.each([
  ['credentialsLimiter', credentialsLimiter],
  ['authLimiter', authLimiter],
  ['apiLimiter', apiLimiter],
] as const)('%s', (_name, build) => {
  it('answers with a 429 payload', () => {
    expect(optionsOf(build).message.statusCode).toBe(429);
    expect(optionsOf(build).message.message).toMatch(/try again/i);
  });

  it('advertises the standard headers only', () => {
    const options = optionsOf(build);
    expect(options.standardHeaders).toBe('draft-8');
    expect(options.legacyHeaders).toBe(false);
  });
});

describe('trustProxyHops', () => {
  const original = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = original;
    }
  });

  it('trusts the bundled web proxy by default', () => {
    delete process.env.TRUST_PROXY_HOPS;
    expect(trustProxyHops()).toBe(1);
  });

  it('honours an extra reverse proxy in front', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    expect(trustProxyHops()).toBe(2);
  });

  it('allows trusting nothing at all', () => {
    process.env.TRUST_PROXY_HOPS = '0';
    expect(trustProxyHops()).toBe(0);
  });

  it.each(['', 'many', '-1', '1.5'])(
    'falls back to one hop for %p',
    (value) => {
      process.env.TRUST_PROXY_HOPS = value;
      expect(trustProxyHops()).toBe(1);
    },
  );
});
