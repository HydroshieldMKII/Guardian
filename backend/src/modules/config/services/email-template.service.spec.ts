import { Test } from '@nestjs/testing';
import { EmailTemplateService } from './email-template.service';

const mockReadFileSync = jest.fn();

jest.mock('fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  const notification = (
    overrides: Partial<{
      type: 'block' | 'new-device' | 'location-change' | 'device-note' | 'info';
      statusColor: string;
      statusLabel: string;
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
      type: 'info' as const,
      statusColor: '#4488ff',
      statusLabel: 'NOTIFICATION',
      mainMessage: 'Something happened',
      username: 'testuser',
      ...overrides,
    };

    return service.generateNotificationEmail(
      args.type,
      args.statusColor,
      args.statusLabel,
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
    mockReadFileSync.mockReturnValue('<svg>logo</svg>');

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
      const encoded = Buffer.from('<svg>logo</svg>').toString('base64');

      expect(notification()).toContain(`data:image/svg+xml;base64,${encoded}`);
    });

    it('stops at the first path that resolves', () => {
      notification();
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('keeps looking when an early path is missing', () => {
      mockReadFileSync
        .mockImplementationOnce(() => {
          throw new Error('ENOENT');
        })
        .mockReturnValueOnce('<svg>logo</svg>');

      expect(notification()).toContain('data:image/svg+xml;base64,');
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    it('falls back to a text heading when the logo is nowhere', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const html = notification();
      expect(html).toContain('<h1>Guardian</h1>');
      expect(html).not.toContain('data:image/svg+xml');
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

    it('escapes the recipients of a test email', () => {
      expect(service.generateSMTPTestEmail([injection], 'ts')).not.toContain(
        '<script>',
      );
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
    it('paints the badge with the caller’s colour', () => {
      const html = notification({
        statusColor: '#ff4444',
        statusLabel: 'STREAM BLOCKED',
      });

      expect(html).toContain('background-color: #ff4444;">STREAM BLOCKED');
    });

    it('uses the same colour for the details border', () => {
      expect(notification({ statusColor: '#ff4444' })).toContain(
        'border-left: 4px solid #ff4444',
      );
    });
  });

  describe('generateSMTPTestEmail', () => {
    it('announces a successful verification', () => {
      const html = service.generateSMTPTestEmail(['admin@example.com'], 'ts');

      expect(html).toContain('Test Successful');
      expect(html).toContain('SMTP Verified');
    });

    it('lists every recipient', () => {
      expect(
        service.generateSMTPTestEmail(['a@example.com', 'b@example.com'], 'ts'),
      ).toContain('a@example.com, b@example.com');
    });

    it('carries the timestamp', () => {
      expect(
        service.generateSMTPTestEmail(['a@example.com'], '2026-08-21'),
      ).toContain('2026-08-21');
    });

    it('labels the footer as a test', () => {
      expect(service.generateSMTPTestEmail([], 'ts')).toContain('SMTP Test');
    });
  });
});
