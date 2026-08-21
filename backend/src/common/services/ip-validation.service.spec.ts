import { Test } from '@nestjs/testing';
import { IPValidationService, NetworkPolicy } from './ip-validation.service';

describe('IPValidationService', () => {
  let service: IPValidationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [IPValidationService],
    }).compile();

    service = module.get(IPValidationService);
  });

  const policy = (overrides: Partial<NetworkPolicy> = {}): NetworkPolicy => ({
    networkPolicy: 'both',
    ipAccessPolicy: 'all',
    allowedIPs: [],
    ...overrides,
  });

  describe('isValidIPv4', () => {
    it.each(['0.0.0.0', '10.0.0.1', '192.168.1.1', '255.255.255.255'])(
      'accepts %s',
      (ip) => expect(service.isValidIPv4(ip)).toBe(true),
    );

    it('tolerates surrounding whitespace', () => {
      expect(service.isValidIPv4('  10.0.0.1 ')).toBe(true);
    });

    it.each(['256.1.1.1', '1.2.3', '1.2.3.4.5', 'abc', '', '10.0.0.1/8'])(
      'rejects %s',
      (ip) => expect(service.isValidIPv4(ip)).toBe(false),
    );
  });

  describe('isValidCIDR', () => {
    it.each(['10.0.0.0/8', '192.168.1.0/24', '0.0.0.0/0', '1.2.3.4/32'])(
      'accepts %s',
      (cidr) => expect(service.isValidCIDR(cidr)).toBe(true),
    );

    it.each(['192.168.1.0/33', '192.168.1.0', '256.0.0.0/8'])(
      'rejects %s',
      (cidr) => expect(service.isValidCIDR(cidr)).toBe(false),
    );
  });

  describe('isPrivateIP', () => {
    it.each([
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '127.0.0.1',
    ])('treats %s as private', (ip) =>
      expect(service.isPrivateIP(ip)).toBe(true),
    );

    it.each(['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.1.1'])(
      'treats %s as public',
      (ip) => expect(service.isPrivateIP(ip)).toBe(false),
    );

    it('rejects an invalid address', () => {
      expect(service.isPrivateIP('nope')).toBe(false);
    });
  });

  describe('getNetworkType', () => {
    it('classifies a private address as lan', () => {
      expect(service.getNetworkType('192.168.0.5')).toBe('lan');
    });

    it('classifies a public address as wan', () => {
      expect(service.getNetworkType('8.8.8.8')).toBe('wan');
    });

    it('classifies an invalid address as unknown', () => {
      expect(service.getNetworkType('999.0.0.1')).toBe('unknown');
    });
  });

  describe('isIPInCIDR', () => {
    it('matches an address inside the range', () => {
      expect(service.isIPInCIDR('192.168.1.55', '192.168.1.0/24')).toBe(true);
    });

    it('rejects an address outside the range', () => {
      expect(service.isIPInCIDR('192.168.2.55', '192.168.1.0/24')).toBe(false);
    });

    it('matches everything for a /0', () => {
      expect(service.isIPInCIDR('8.8.8.8', '0.0.0.0/0')).toBe(true);
    });

    it('matches only the exact host for a /32', () => {
      expect(service.isIPInCIDR('10.1.2.3', '10.1.2.3/32')).toBe(true);
      expect(service.isIPInCIDR('10.1.2.4', '10.1.2.3/32')).toBe(false);
    });

    it('handles addresses with the high bit set', () => {
      expect(service.isIPInCIDR('200.0.0.1', '200.0.0.0/8')).toBe(true);
    });

    it('returns false for malformed input', () => {
      expect(service.isIPInCIDR('bad', '10.0.0.0/8')).toBe(false);
      expect(service.isIPInCIDR('10.0.0.1', 'bad')).toBe(false);
    });
  });

  describe('isIPInAllowedList', () => {
    it('allows any valid address when the list is empty', () => {
      expect(service.isIPInAllowedList('8.8.8.8', [])).toBe(true);
    });

    it('matches an exact entry', () => {
      expect(service.isIPInAllowedList('8.8.8.8', ['1.1.1.1', '8.8.8.8'])).toBe(
        true,
      );
    });

    it('matches a CIDR entry', () => {
      expect(service.isIPInAllowedList('10.4.5.6', ['10.0.0.0/8'])).toBe(true);
    });

    it('ignores whitespace around entries', () => {
      expect(service.isIPInAllowedList('8.8.8.8', ['  8.8.8.8 '])).toBe(true);
    });

    it('skips unparseable entries', () => {
      expect(service.isIPInAllowedList('8.8.8.8', ['garbage'])).toBe(false);
      expect(service.isIPInAllowedList('8.8.8.8', ['garbage', '8.8.8.8'])).toBe(
        true,
      );
    });

    it('rejects an invalid client address', () => {
      expect(service.isIPInAllowedList('nope', [])).toBe(false);
    });
  });

  describe('validateIPAccess', () => {
    it('rejects a missing address', () => {
      expect(service.validateIPAccess('', policy())).toEqual({
        allowed: false,
        reason: 'Invalid or missing client IP address',
      });
    });

    it('rejects a malformed address', () => {
      expect(service.validateIPAccess('nope', policy())).toEqual({
        allowed: false,
        reason: 'Invalid or missing client IP address',
      });
    });

    it('allows anything under the default policy', () => {
      expect(service.validateIPAccess('8.8.8.8', policy())).toEqual({
        allowed: true,
      });
    });

    it('blocks a WAN address under a lan-only policy', () => {
      expect(
        service.validateIPAccess('8.8.8.8', policy({ networkPolicy: 'lan' })),
      ).toEqual({
        allowed: false,
        reason: 'Only LAN access is allowed',
        stopCode: 'IP_POLICY_LAN_ONLY',
      });
    });

    it('uses the custom lan-only message', () => {
      const result = service.validateIPAccess(
        '8.8.8.8',
        policy({ networkPolicy: 'lan' }),
        { lanOnly: 'Home only' },
      );
      expect(result.reason).toBe('Home only');
    });

    it('allows a LAN address under a lan-only policy', () => {
      expect(
        service.validateIPAccess(
          '192.168.1.5',
          policy({ networkPolicy: 'lan' }),
        ),
      ).toEqual({ allowed: true });
    });

    it('blocks a LAN address under a wan-only policy', () => {
      expect(
        service.validateIPAccess(
          '192.168.1.5',
          policy({ networkPolicy: 'wan' }),
        ),
      ).toEqual({
        allowed: false,
        reason: 'Only WAN access is allowed',
        stopCode: 'IP_POLICY_WAN_ONLY',
      });
    });

    it('uses the custom wan-only message', () => {
      const result = service.validateIPAccess(
        '192.168.1.5',
        policy({ networkPolicy: 'wan' }),
        { wanOnly: 'Away only' },
      );
      expect(result.reason).toBe('Away only');
    });

    it('blocks an unlisted address when restricted', () => {
      expect(
        service.validateIPAccess(
          '8.8.8.8',
          policy({ ipAccessPolicy: 'restricted', allowedIPs: ['1.1.1.1'] }),
        ),
      ).toEqual({
        allowed: false,
        reason: 'Your current IP address is not in the allowed list',
        stopCode: 'IP_POLICY_NOT_ALLOWED',
      });
    });

    it('uses the custom not-allowed message', () => {
      const result = service.validateIPAccess(
        '8.8.8.8',
        policy({ ipAccessPolicy: 'restricted', allowedIPs: ['1.1.1.1'] }),
        { notAllowed: 'Denied' },
      );
      expect(result.reason).toBe('Denied');
    });

    it('allows a listed address when restricted', () => {
      expect(
        service.validateIPAccess(
          '8.8.8.8',
          policy({ ipAccessPolicy: 'restricted', allowedIPs: ['8.8.8.8'] }),
        ),
      ).toEqual({ allowed: true });
    });

    it('applies both the network and allow-list checks together', () => {
      expect(
        service.validateIPAccess(
          '192.168.1.5',
          policy({
            networkPolicy: 'lan',
            ipAccessPolicy: 'restricted',
            allowedIPs: ['192.168.1.0/24'],
          }),
        ),
      ).toEqual({ allowed: true });
    });
  });
});
