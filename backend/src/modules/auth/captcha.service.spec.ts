import { Test } from '@nestjs/testing';
import { ConfigService } from '@/modules/config/services/config.service';
import { CaptchaService } from '@/modules/auth/captcha.service';
import type { Mock } from 'vitest';

describe('CaptchaService', () => {
  let service: CaptchaService;
  let configService: { getSetting: Mock };
  const fetchMock = vi.fn();

  beforeEach(async () => {
    configService = { getSetting: vi.fn().mockResolvedValue('  secret  ') };
    globalThis.fetch = fetchMock;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      json: async () => ({ success: true }),
    }));

    const module = await Test.createTestingModule({
      providers: [
        CaptchaService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(CaptchaService);
  });

  it('passes without a token when no secret is configured', async () => {
    configService.getSetting.mockResolvedValue(null);
    await expect(service.verify()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes a token Cloudflare accepts', async () => {
    await expect(service.verify('captcha-token')).resolves.toBeUndefined();
  });

  it('verifies the token against Cloudflare with the trimmed secret', async () => {
    await service.verify('captcha-token');

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(JSON.parse(init.body)).toEqual({
      secret: 'secret',
      response: 'captcha-token',
    });
  });

  it('refuses a missing token', async () => {
    await expect(service.verify()).rejects.toThrow(
      'Captcha validation required',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a token Cloudflare rejects', async () => {
    fetchMock.mockImplementation(async () => ({
      json: async () => ({ success: false }),
    }));
    await expect(service.verify('bad')).rejects.toThrow(
      'Captcha validation failed',
    );
  });

  it('refuses when Cloudflare is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(service.verify('token')).rejects.toThrow(
      'Failed to verify captcha',
    );
  });

  it('skips verification when the configured secret is blank', async () => {
    configService.getSetting.mockResolvedValue('   ');
    await expect(service.verify()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
