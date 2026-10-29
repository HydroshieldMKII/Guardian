import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@/modules/config/services/config.service';

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

@Injectable()
export class CaptchaService {
  constructor(private readonly configService: ConfigService) {}

  async verify(token?: string): Promise<void> {
    const secretKey = (
      await this.configService.getSetting('CLOUDFLARE_TURNSTILE_SECRET_KEY')
    )?.trim();

    if (!secretKey) {
      return;
    }

    if (!token) {
      throw new UnauthorizedException('Captcha validation required');
    }

    try {
      const response = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
        }),
      });

      const data = (await response.json()) as { success: boolean };

      if (!data.success) {
        throw new UnauthorizedException('Captcha validation failed');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to verify captcha');
    }
  }
}
