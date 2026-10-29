import {
  createSmtpTransport,
  senderAddress,
  SMTPConfig,
  smtpErrorMessage,
  SmtpSettings,
  toSmtpConfig,
  validateSmtpConfig,
} from './smtp-config';

const mockCreateTransport = vi.fn<(...args: unknown[]) => unknown>();

vi.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

type TransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  tls: { rejectUnauthorized: boolean };
  connectionTimeout: number;
};

const stored = (overrides: Partial<SmtpSettings> = {}): SmtpSettings => ({
  SMTP_ENABLED: true,
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_USER: 'guardian',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM_EMAIL: 'from@example.com',
  SMTP_FROM_NAME: 'Guardian',
  SMTP_USE_TLS: true,
  SMTP_TO_EMAILS: 'admin@example.com',
  ...overrides,
});

const config = (overrides: Partial<SMTPConfig> = {}): SMTPConfig => ({
  host: 'smtp.example.com',
  port: 587,
  user: 'guardian',
  password: 'secret',
  fromEmail: 'from@example.com',
  fromName: 'Guardian',
  useTLS: true,
  toEmails: ['admin@example.com'],
  ...overrides,
});

describe('toSmtpConfig', () => {
  it('maps the stored settings onto a transport config', () => {
    expect(toSmtpConfig(stored())).toEqual(config());
  });

  it('honours the boolean TLS setting rather than a string', () => {
    expect(toSmtpConfig(stored()).useTLS).toBe(true);
    expect(toSmtpConfig(stored({ SMTP_USE_TLS: false })).useTLS).toBe(false);
  });

  it('splits recipients on commas, semicolons and newlines', () => {
    const result = toSmtpConfig(
      stored({
        SMTP_TO_EMAILS:
          'a@example.com, b@example.com;c@example.com\nd@example.com',
      }),
    );

    expect(result.toEmails).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
      'd@example.com',
    ]);
  });

  it('yields an empty recipient list when none are configured', () => {
    expect(toSmtpConfig(stored({ SMTP_TO_EMAILS: '' })).toEmails).toEqual([]);
  });

  it('drops blank entries left by trailing separators', () => {
    expect(
      toSmtpConfig(stored({ SMTP_TO_EMAILS: 'a@example.com,, ;\n' })).toEmails,
    ).toEqual(['a@example.com']);
  });
});

describe('validateSmtpConfig', () => {
  it('accepts a complete configuration', () => {
    expect(validateSmtpConfig(config())).toBeNull();
  });

  it.each([
    ['host', { host: '' }],
    ['port', { port: 0 }],
    ['user', { user: '' }],
    ['password', { password: '' }],
    ['from address', { fromEmail: '' }],
  ] as const)('refuses without a %s', (_field, overrides) => {
    expect(validateSmtpConfig(config(overrides))).toContain(
      'Missing required SMTP configuration',
    );
  });

  it.each([25, 2525])('refuses TLS on port %s', (port) => {
    expect(validateSmtpConfig(config({ port }))).toBe(
      'TLS is not supported on this port. Please use port 465 or 587.',
    );
  });

  it.each([465, 587])('accepts TLS on port %s', (port) => {
    expect(validateSmtpConfig(config({ port }))).toBeNull();
  });

  it('allows any port when TLS is off', () => {
    expect(validateSmtpConfig(config({ port: 25, useTLS: false }))).toBeNull();
  });

  it('refuses with no recipients', () => {
    expect(validateSmtpConfig(config({ toEmails: [] }))).toContain(
      'No recipient email addresses',
    );
  });

  it('names the recipients it could not parse', () => {
    expect(
      validateSmtpConfig(
        config({ toEmails: ['fine@example.com', 'nope', 'also bad'] }),
      ),
    ).toBe('Invalid email format(s): nope, also bad');
  });
});

describe('senderAddress', () => {
  it('sends from the display name when one is set', () => {
    expect(senderAddress(config())).toBe('Guardian <from@example.com>');
  });

  it('falls back to the bare address with no display name', () => {
    expect(senderAddress(config({ fromName: undefined }))).toBe(
      'from@example.com',
    );
  });
});

describe('createSmtpTransport', () => {
  const transportOptions = (target: SMTPConfig) => {
    mockCreateTransport.mockClear();
    createSmtpTransport(target);
    return mockCreateTransport.mock.calls[0][0] as TransportOptions;
  };

  it('only negotiates implicit TLS on port 465', () => {
    expect(transportOptions(config({ port: 465 })).secure).toBe(true);
    expect(transportOptions(config({ port: 587 })).secure).toBe(false);
    expect(transportOptions(config({ port: 465, useTLS: false })).secure).toBe(
      false,
    );
  });

  it('passes the credentials and timeouts to the transport', () => {
    expect(transportOptions(config())).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'guardian', pass: 'secret' },
      connectionTimeout: 15000,
    });
  });
});

describe('smtpErrorMessage', () => {
  const failure = (fields: { code?: string; responseCode?: number }) =>
    Object.assign(new Error('raw'), fields);

  it.each([
    [
      'EAUTH',
      'Authentication failed. Please check your username and password.',
    ],
    [
      'ECONNECTION',
      'Failed to connect to SMTP server. Please check the host and port.',
    ],
    ['ETIMEDOUT', 'Connection timed out. Please check your email settings.'],
    ['ENOTFOUND', 'SMTP server not found. Please check the hostname.'],
  ])('translates a %s failure', (code, message) => {
    expect(smtpErrorMessage(failure({ code }))).toBe(message);
  });

  it.each([
    [535, 'Authentication failed. Please verify your credentials.'],
    [550, 'Email rejected by server. Please check recipient addresses.'],
  ])('translates response code %s', (responseCode, message) => {
    expect(smtpErrorMessage(failure({ responseCode }))).toBe(message);
  });

  it('prefers the error code over the response code', () => {
    expect(
      smtpErrorMessage(failure({ code: 'EAUTH', responseCode: 550 })),
    ).toBe('Authentication failed. Please check your username and password.');
  });

  it.each([
    ['an unknown code', { code: 'EWHATEVER' }],
    ['an unknown response code', { responseCode: 421 }],
    ['no code at all', {}],
  ])('surfaces %s verbatim', (_case, fields) => {
    expect(smtpErrorMessage(failure(fields))).toBe('SMTP error: raw');
  });
});
