import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EmailTemplateService } from './email-template.service';

const realReadFileSync =
  jest.requireActual<typeof import('fs')>('fs').readFileSync;
const mockReadFileSync = jest.fn<unknown, unknown[]>();

jest.mock('fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

const readTemplatesForReal = (
  logo: string | (() => never),
  override: (file: string) => string | undefined = () => undefined,
) =>
  mockReadFileSync.mockImplementation((path: unknown) => {
    const file = String(path);
    const replacement = override(file);
    if (replacement !== undefined) {
      if (replacement === MISSING) throw new Error('ENOENT');
      return replacement;
    }
    if (file.endsWith('.svg')) {
      return typeof logo === 'function' ? logo() : logo;
    }
    return realReadFileSync(file, 'utf8');
  });

const MISSING = '\u0000missing';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  const notification = (
    overrides: Partial<{
      type: 'block' | 'new-device' | 'location-change' | 'device-note';
      statusColor: string;
      mainMessage: string;
      username: string;
      deviceName?: string;
      stopCode?: string;
      timestamp?: string;
      ipAddress?: string;
      oldIpAddress?: string;
      note?: string;
    }> = {},
  ) => {
    const args = {
      type: 'block' as const,
      statusColor: '#4488ff',
      mainMessage: 'Something happened',
      username: 'testuser',
      ...overrides,
    };

    return service.generateNotificationEmail(
      args.type,
      args.statusColor,
      args.mainMessage,
      args.username,
      args.deviceName,
      args.stopCode,
      args.timestamp,
      args.ipAddress,
      args.oldIpAddress,
      args.note,
    );
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    readTemplatesForReal('<svg>logo</svg>');

    const module = await Test.createTestingModule({
      providers: [EmailTemplateService],
    }).compile();

    service = module.get(EmailTemplateService);
  });

  describe('document shape', () => {
    it('emits a complete html document', () => {
      const html = notification();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('inlines the stylesheet rather than linking one', () => {
      const html = notification();

      expect(html).toContain('<style>');
      expect(html).not.toContain('<link');
    });

    it('carries the timestamp into the footer', () => {
      expect(notification({ timestamp: '2026-08-21 12:00:00' })).toContain(
        '2026-08-21 12:00:00',
      );
    });

    it('leaves the timestamp blank when none is given', () => {
      expect(notification()).toContain('<div class="timestamp"></div>');
    });
  });

  describe('logo', () => {
    it('inlines the logo as a base64 data uri', () => {
      expect(notification()).toContain('data:image/svg+xml;base64,');
    });

    it('sits on a white plate so it survives a client that darkens the page', () => {
      expect(notification()).toContain(
        'class="logo-plate" style="background-color: #ffffff;"',
      );
    });

    it('crops the artboard so the header stays shallow', () => {
      readTemplatesForReal('<svg viewBox="0 0 1024 768">logo</svg>');

      const cropped = Buffer.from(
        '<svg viewBox="0 250 1024 266">logo</svg>',
      ).toString('base64');

      expect(notification()).toContain(cropped);
    });

    it('keeps looking when an early path is missing', () => {
      readTemplatesForReal('<svg>logo</svg>');

      expect(notification()).toContain('data:image/svg+xml;base64,');
      expect(mockReadFileSync.mock.calls.length).toBeGreaterThan(1);
    });

    it('falls back to a text heading when the logo is nowhere', () => {
      readTemplatesForReal(() => {
        throw new Error('ENOENT');
      });

      const html = notification();
      expect(html).toContain('<h1>Guardian</h1>');
      expect(html).not.toContain('data:image/svg+xml');
    });
  });

  describe('missing template files', () => {
    it('renders nothing rather than a broken document', () => {
      const logged = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      readTemplatesForReal('<svg>logo</svg>', (file) =>
        file.endsWith('layout.html') ? MISSING : undefined,
      );

      expect(notification()).toBe('');
      expect(logged).toHaveBeenCalledWith(
        'Email template not found: layout.html',
      );
      logged.mockRestore();
    });

    it('carries on without the stylesheet', () => {
      readTemplatesForReal('<svg>logo</svg>', (file) =>
        file.endsWith('styles.css') ? MISSING : undefined,
      );

      const html = notification();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<style>');
      expect(html).not.toContain('.email-wrapper');
    });

    it('leaves an unknown placeholder empty rather than printing it', () => {
      readTemplatesForReal('<svg>logo</svg>', (file) =>
        file.endsWith('layout.html')
          ? '<p>{{mainMessage}}</p><p>{{nothingSuppliesThis}}</p>'
          : undefined,
      );

      const html = notification();

      expect(html).toContain('Something happened');
      expect(html).not.toContain('{{');
    });
  });

  describe('escaping', () => {
    const injection = '<script>alert(1)</script>';

    it('escapes the username', () => {
      const html = notification({ username: injection });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes the device name', () => {
      expect(notification({ deviceName: injection })).not.toContain('<script>');
    });

    it('escapes the note', () => {
      expect(
        notification({ type: 'device-note', note: injection }),
      ).not.toContain('<script>');
    });

    it('escapes the stop code', () => {
      expect(notification({ stopCode: injection })).not.toContain('<script>');
    });

    it('escapes the main message, which embeds the device name', () => {
      const html = notification({
        mainMessage: `A new device "${injection}" was detected`,
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it.each([
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['"', '&quot;'],
      ["'", '&#39;'],
    ])('escapes %p as %p', (raw, escaped) => {
      expect(notification({ username: `a${raw}b` })).toContain(`a${escaped}b`);
    });

    it('encodes an address before putting it in a link', () => {
      const html = notification({ ipAddress: '1.2.3.4" onload="x' });

      expect(html).not.toContain('onload="x');
      expect(html).toContain('https://ipinfo.io/1.2.3.4%22%20onload%3D%22x');
    });
  });

  describe('detail rows', () => {
    it('always names the user', () => {
      expect(notification()).toContain('testuser');
    });

    it('omits the device row when there is no device', () => {
      expect(notification()).not.toContain('>Device<');
    });

    it('includes the device row when there is one', () => {
      expect(notification({ deviceName: 'Shield' })).toContain('>Device<');
    });

    it('shows a single address on its own', () => {
      const html = notification({ ipAddress: '1.2.3.4' });

      expect(html).toContain('>IP Address<');
      expect(html).not.toContain('>Old IP<');
    });

    it('shows both addresses on a location change', () => {
      const html = notification({
        type: 'location-change',
        ipAddress: '1.2.3.4',
        oldIpAddress: '10.0.0.1',
      });

      expect(html).toContain('>Old IP<');
      expect(html).toContain('>New IP<');
      expect(html).toContain('https://ipinfo.io/10.0.0.1');
      expect(html).toContain('https://ipinfo.io/1.2.3.4');
    });

    it('ignores an old address with no new one', () => {
      const html = notification({ oldIpAddress: '10.0.0.1' });

      expect(html).not.toContain('>Old IP<');
      expect(html).not.toContain('>IP Address<');
    });

    it('links addresses without leaking the referrer', () => {
      expect(notification({ ipAddress: '1.2.3.4' })).toContain(
        'rel="noopener noreferrer"',
      );
    });

    it('shows the type in upper case', () => {
      expect(notification({ type: 'new-device' })).toContain('NEW-DEVICE');
    });

    it('omits the code row when there is no stop code', () => {
      expect(notification()).not.toContain('>Code<');
    });

    it('includes the code row when there is one', () => {
      expect(notification({ stopCode: 'DEVICE_PENDING' })).toContain(
        'DEVICE_PENDING',
      );
    });

    it('shows the note only on a device-note notification', () => {
      expect(
        notification({ type: 'device-note', note: 'please approve' }),
      ).toContain('please approve');
      expect(
        notification({ type: 'block', note: 'please approve' }),
      ).not.toContain('please approve');
    });

    it('preserves the line breaks in a note', () => {
      expect(
        notification({ type: 'device-note', note: 'line one\nline two' }),
      ).toContain('white-space: pre-wrap');
    });
  });

  describe('status styling', () => {
    it('paints the type pill with the caller’s colour', () => {
      expect(notification({ statusColor: '#ff4444', type: 'block' })).toContain(
        'background-color: #ff4444;">BLOCK',
      );
    });

    it('uses the same colour for the accent bar', () => {
      expect(notification({ statusColor: '#ff4444' })).toContain(
        'class="accent-bar" style="background-color: #ff4444;"',
      );
    });

    it('leaves no badge above the message', () => {
      expect(notification()).not.toContain('class="badge"');
    });
  });

  describe('generatePasswordResetEmail', () => {
    const reset = (
      url = 'https://guardian.example.com/reset-password?token=abc',
    ) =>
      service.generatePasswordResetEmail('owner', url, 15, '2026-08-21 12:00');

    it('links the button at the reset address', () => {
      expect(reset()).toContain(
        'href="https://guardian.example.com/reset-password?token=abc"',
      );
    });

    it('repeats the address for clients that strip the button', () => {
      const html = reset();
      const occurrences = html.split(
        'https://guardian.example.com/reset-password?token=abc',
      ).length;
      expect(occurrences).toBeGreaterThan(2);
    });

    it('names the account and how long the link lasts', () => {
      const html = reset();
      expect(html).toContain('>owner<');
      expect(html).toContain('15 minutes');
    });

    it('says the link works once', () => {
      expect(reset()).toContain('works once');
    });

    it('drops the badge, the details block and the footer tag', () => {
      const html = reset();

      expect(html).not.toContain('class="badge"');
      expect(html).not.toContain('class="details"');
      expect(html).toContain('<div class="footer">');
      expect(html).not.toMatch(/<div class="footer">\s*<p>/);
    });

    it('tells the reader they can ignore it', () => {
      expect(reset()).toContain('ignore this email');
    });

    it('escapes an address that carries markup', () => {
      const html = reset('https://x.test/?t="><script>alert(1)</script>');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes a username that carries markup', () => {
      const html = service.generatePasswordResetEmail(
        '<script>alert(1)</script>',
        'https://x.test',
        15,
        'ts',
      );
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('carries the timestamp', () => {
      expect(reset()).toContain('2026-08-21 12:00');
    });
  });

  describe('generateSMTPTestEmail', () => {
    it('announces a successful verification', () => {
      expect(service.generateSMTPTestEmail('ts')).toContain(
        'test completed successfully',
      );
    });

    it('says it with the message alone', () => {
      expect(service.generateSMTPTestEmail('ts')).not.toContain(
        'class="details"',
      );
    });

    it('carries the timestamp', () => {
      expect(service.generateSMTPTestEmail('2026-08-21')).toContain(
        '2026-08-21',
      );
    });

    it('labels the footer as a test', () => {
      expect(service.generateSMTPTestEmail('ts')).toContain('SMTP Test');
    });
  });
});
