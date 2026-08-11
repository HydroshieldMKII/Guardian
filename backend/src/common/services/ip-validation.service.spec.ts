import { IPValidationService, NetworkPolicy } from './ip-validation.service';

describe('IPValidationService', () => {
  let service: IPValidationService;

  beforeEach(() => {
    service = new IPValidationService();
  });

  const basePolicy: NetworkPolicy = {
    networkPolicy: 'both',
    ipAccessPolicy: 'all',
    allowedIPs: [],
  };

  describe('isValidIPv4', () => {
    it('accepts a valid dotted-quad address', () => {
      expect(service.isValidIPv4('192.168.1.1')).toBe(true);
    });

    it('rejects an octet above 255', () => {
      expect(service.isValidIPv4('256.1.1.1')).toBe(false);
    });

    it('rejects an IPv6 address', () => {
      expect(service.isValidIPv4('2001:db8::1')).toBe(false);
    });

    it('rejects garbage input', () => {
      expect(service.isValidIPv4('not-an-ip')).toBe(false);
    });
  });

  describe('isValidIPv6', () => {
    it('accepts the loopback address', () => {
      expect(service.isValidIPv6('::1')).toBe(true);
    });

    it('accepts a compressed global unicast address', () => {
      expect(service.isValidIPv6('2001:db8::1')).toBe(true);
    });

    it('accepts a fully expanded address', () => {
      expect(
        service.isValidIPv6('2001:0db8:0000:0000:0000:0000:0000:0001'),
      ).toBe(true);
    });

    it('accepts an IPv4-mapped address', () => {
      expect(service.isValidIPv6('::ffff:192.168.1.1')).toBe(true);
    });

    it('accepts a link-local address with a zone index', () => {
      expect(service.isValidIPv6('fe80::1%eth0')).toBe(true);
    });

    it('rejects an IPv4 address', () => {
      expect(service.isValidIPv6('192.168.1.1')).toBe(false);
    });

    it('rejects garbage input', () => {
      expect(service.isValidIPv6('not-an-ip')).toBe(false);
    });

    it('rejects an address with an invalid hex group', () => {
      expect(service.isValidIPv6('2001:db8::g')).toBe(false);
    });
  });

  describe('isValidIP', () => {
    it('accepts a valid IPv4 address', () => {
      expect(service.isValidIP('10.0.0.1')).toBe(true);
    });

    it('accepts a valid IPv6 address', () => {
      expect(service.isValidIP('2001:db8::1')).toBe(true);
    });

    it('rejects garbage input', () => {
      expect(service.isValidIP('not-an-ip')).toBe(false);
    });
  });

  describe('isValidCIDRv6', () => {
    it('accepts a valid IPv6 CIDR', () => {
      expect(service.isValidCIDRv6('2001:db8::/32')).toBe(true);
    });

    it('accepts prefix length 0 and 128 (boundary)', () => {
      expect(service.isValidCIDRv6('::/0')).toBe(true);
      expect(service.isValidCIDRv6('::1/128')).toBe(true);
    });

    it('rejects a prefix length above 128', () => {
      expect(service.isValidCIDRv6('2001:db8::/129')).toBe(false);
    });

    it('rejects an IPv4 CIDR', () => {
      expect(service.isValidCIDRv6('192.168.1.0/24')).toBe(false);
    });

    it('rejects a plain address without a prefix', () => {
      expect(service.isValidCIDRv6('2001:db8::1')).toBe(false);
    });
  });

  describe('normalizeIP', () => {
    it('normalizes an IPv4-mapped IPv6 address to its IPv4 form', () => {
      expect(service.normalizeIP('::ffff:192.168.1.10')).toBe('192.168.1.10');
    });

    it('normalizes the hex-group form of an IPv4-mapped address', () => {
      expect(service.normalizeIP('::ffff:c0a8:10a')).toBe('192.168.1.10');
    });

    it('leaves a plain IPv4 address unchanged', () => {
      expect(service.normalizeIP('192.168.1.10')).toBe('192.168.1.10');
    });

    it('leaves a "real" (non-mapped) IPv6 address unchanged', () => {
      expect(service.normalizeIP('2001:db8::1')).toBe('2001:db8::1');
    });

    it('leaves an invalid address unchanged (trimmed)', () => {
      expect(service.normalizeIP('  not-an-ip  ')).toBe('not-an-ip');
    });
  });

  describe('isPrivateIP', () => {
    // --- IPv4 (pre-existing behaviour, must stay unchanged) ---
    it('treats 10.0.0.0/8 as private', () => {
      expect(service.isPrivateIP('10.1.2.3')).toBe(true);
    });

    it('treats 172.16.0.0/12 as private', () => {
      expect(service.isPrivateIP('172.20.0.1')).toBe(true);
      expect(service.isPrivateIP('172.15.0.1')).toBe(false);
      expect(service.isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('treats 192.168.0.0/16 as private', () => {
      expect(service.isPrivateIP('192.168.1.1')).toBe(true);
    });

    it('treats 127.0.0.0/8 as private', () => {
      expect(service.isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('treats a public IPv4 address as not private', () => {
      expect(service.isPrivateIP('8.8.8.8')).toBe(false);
    });

    // --- IPv6 ---
    it('treats ::1 (loopback) as private', () => {
      expect(service.isPrivateIP('::1')).toBe(true);
    });

    it('treats fc00::/7 (unique local) as private', () => {
      expect(service.isPrivateIP('fc00::1')).toBe(true);
      expect(service.isPrivateIP('fdff:ffff::1')).toBe(true);
      expect(service.isPrivateIP('fe00::1')).toBe(false);
    });

    it('treats fe80::/10 (link-local) as private', () => {
      expect(service.isPrivateIP('fe80::1')).toBe(true);
      expect(service.isPrivateIP('febf:ffff::1')).toBe(true);
      expect(service.isPrivateIP('fec0::1')).toBe(false);
    });

    it('treats a public IPv6 (GUA) address as not private', () => {
      expect(service.isPrivateIP('2001:db8::1')).toBe(false);
    });

    // --- IPv4-mapped IPv6 must classify exactly like its IPv4 form ---
    it('treats an IPv4-mapped private address as private', () => {
      expect(service.isPrivateIP('::ffff:192.168.1.1')).toBe(true);
    });

    it('treats an IPv4-mapped public address as not private', () => {
      expect(service.isPrivateIP('::ffff:8.8.8.8')).toBe(false);
    });

    it('returns false for an invalid address', () => {
      expect(service.isPrivateIP('not-an-ip')).toBe(false);
    });
  });

  describe('getNetworkType', () => {
    it('classifies a private IPv4 address as lan', () => {
      expect(service.getNetworkType('192.168.1.1')).toBe('lan');
    });

    it('classifies a public IPv4 address as wan', () => {
      expect(service.getNetworkType('8.8.8.8')).toBe('wan');
    });

    it('classifies a private IPv6 address as lan', () => {
      expect(service.getNetworkType('fd12:3456:789a::1')).toBe('lan');
    });

    it('classifies a public IPv6 address as wan', () => {
      expect(service.getNetworkType('2001:db8::1')).toBe('wan');
    });

    it('classifies an IPv4-mapped private IPv6 address as lan', () => {
      expect(service.getNetworkType('::ffff:10.0.0.5')).toBe('lan');
    });

    it('returns unknown for an invalid address', () => {
      expect(service.getNetworkType('not-an-ip')).toBe('unknown');
    });
  });

  describe('isIPInCIDR', () => {
    // --- IPv4 (pre-existing behaviour) ---
    it('matches an IPv4 address inside the range', () => {
      expect(service.isIPInCIDR('192.168.1.42', '192.168.1.0/24')).toBe(true);
    });

    it('rejects an IPv4 address outside the range', () => {
      expect(service.isIPInCIDR('192.168.2.42', '192.168.1.0/24')).toBe(false);
    });

    // --- IPv6 ---
    it('matches an IPv6 address inside the range', () => {
      expect(service.isIPInCIDR('2001:db8:1234::5', '2001:db8::/32')).toBe(
        true,
      );
    });

    it('rejects an IPv6 address outside the range', () => {
      expect(service.isIPInCIDR('2001:db9::5', '2001:db8::/32')).toBe(false);
    });

    it('matches exactly at the CIDR boundary (single-host /128)', () => {
      expect(service.isIPInCIDR('::1', '::1/128')).toBe(true);
      expect(service.isIPInCIDR('::2', '::1/128')).toBe(false);
    });

    // --- cross-family: must never match ---
    it('does not match an IPv4 address against an IPv6 CIDR', () => {
      expect(service.isIPInCIDR('192.168.1.1', '2001:db8::/32')).toBe(false);
    });

    it('does not match an IPv6 address against an IPv4 CIDR', () => {
      expect(service.isIPInCIDR('2001:db8::1', '192.168.1.0/24')).toBe(false);
    });

    it('matches an IPv4-mapped IPv6 address against an IPv4 CIDR', () => {
      expect(service.isIPInCIDR('::ffff:192.168.1.42', '192.168.1.0/24')).toBe(
        true,
      );
    });
  });

  describe('isIPInAllowedList', () => {
    it('allows any IP when the list is empty', () => {
      expect(service.isIPInAllowedList('8.8.8.8', [])).toBe(true);
    });

    it('matches an exact IPv4 entry', () => {
      expect(service.isIPInAllowedList('192.168.1.5', ['192.168.1.5'])).toBe(
        true,
      );
    });

    it('matches an IPv4 CIDR entry', () => {
      expect(service.isIPInAllowedList('192.168.1.5', ['192.168.1.0/24'])).toBe(
        true,
      );
    });

    it('rejects an IPv4 address not covered by the list', () => {
      expect(service.isIPInAllowedList('10.0.0.1', ['192.168.1.0/24'])).toBe(
        false,
      );
    });

    it('matches an exact IPv6 entry', () => {
      expect(service.isIPInAllowedList('2001:db8::1', ['2001:db8::1'])).toBe(
        true,
      );
    });

    it('matches an IPv6 CIDR entry', () => {
      expect(service.isIPInAllowedList('2001:db8::1', ['2001:db8::/32'])).toBe(
        true,
      );
    });

    it('rejects an IPv6 address not covered by the list', () => {
      expect(service.isIPInAllowedList('2001:db9::1', ['2001:db8::/32'])).toBe(
        false,
      );
    });

    it('matches against a mixed IPv4/IPv6 allow list', () => {
      const allowed = ['192.168.1.0/24', '2001:db8::/32'];
      expect(service.isIPInAllowedList('192.168.1.42', allowed)).toBe(true);
      expect(service.isIPInAllowedList('2001:db8::42', allowed)).toBe(true);
      expect(service.isIPInAllowedList('10.0.0.1', allowed)).toBe(false);
      expect(service.isIPInAllowedList('2001:db9::1', allowed)).toBe(false);
    });

    it('matches an IPv4-mapped client against a plain IPv4 allow entry', () => {
      expect(
        service.isIPInAllowedList('::ffff:192.168.1.5', ['192.168.1.5']),
      ).toBe(true);
    });

    it('rejects an invalid client address', () => {
      expect(service.isIPInAllowedList('not-an-ip', ['192.168.1.5'])).toBe(
        false,
      );
    });
  });

  describe('validateIPAccess', () => {
    it('allows a private IPv4 client under the default policy', () => {
      expect(service.validateIPAccess('192.168.1.5', basePolicy).allowed).toBe(
        true,
      );
    });

    it('rejects a missing client IP', () => {
      const result = service.validateIPAccess('', basePolicy);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Invalid or missing client IP address');
    });

    it('rejects a syntactically invalid client IP', () => {
      const result = service.validateIPAccess('not-an-ip', basePolicy);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Invalid or missing client IP address');
    });

    // --- this is the regression test for the reported bug ---
    it('no longer rejects a well-formed IPv6 client under a permissive policy', () => {
      const result = service.validateIPAccess('2001:db8::1', basePolicy);
      expect(result.allowed).toBe(true);
    });

    it('enforces a lan-only policy against an IPv6 client', () => {
      const policy: NetworkPolicy = { ...basePolicy, networkPolicy: 'lan' };

      const lanResult = service.validateIPAccess('fd12:3456:789a::1', policy);
      expect(lanResult.allowed).toBe(true);

      const wanResult = service.validateIPAccess('2001:db8::1', policy);
      expect(wanResult.allowed).toBe(false);
      expect(wanResult.stopCode).toBe('IP_POLICY_LAN_ONLY');
    });

    it('enforces a wan-only policy against an IPv6 client', () => {
      const policy: NetworkPolicy = { ...basePolicy, networkPolicy: 'wan' };

      const wanResult = service.validateIPAccess('2001:db8::1', policy);
      expect(wanResult.allowed).toBe(true);

      const lanResult = service.validateIPAccess('fd12:3456:789a::1', policy);
      expect(lanResult.allowed).toBe(false);
      expect(lanResult.stopCode).toBe('IP_POLICY_WAN_ONLY');
    });

    it('enforces a restricted allow list against an IPv6 client', () => {
      const policy: NetworkPolicy = {
        ...basePolicy,
        ipAccessPolicy: 'restricted',
        allowedIPs: ['2001:db8::/32'],
      };

      const allowed = service.validateIPAccess('2001:db8::42', policy);
      expect(allowed.allowed).toBe(true);

      const denied = service.validateIPAccess('2001:db9::1', policy);
      expect(denied.allowed).toBe(false);
      expect(denied.stopCode).toBe('IP_POLICY_NOT_ALLOWED');
    });

    it('does not silently reclassify a real IPv6 WAN client as lan', () => {
      // Guards against a naive "treat every IPv6 address as WAN" or
      // "treat every IPv6 address as unclassified/lan" implementation,
      // which would change the meaning of an existing lan-only policy.
      const policy: NetworkPolicy = { ...basePolicy, networkPolicy: 'lan' };
      const result = service.validateIPAccess('2001:db8::1', policy);
      expect(result.allowed).toBe(false);
    });

    it('uses the provided custom messages for IPv6 policy rejections', () => {
      const policy: NetworkPolicy = { ...basePolicy, networkPolicy: 'lan' };
      const result = service.validateIPAccess('2001:db8::1', policy, {
        lanOnly: 'custom lan message',
      });
      expect(result.reason).toBe('custom lan message');
    });
  });
});
