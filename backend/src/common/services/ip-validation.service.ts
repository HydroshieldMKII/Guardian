import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^(?:${OCTET}\\.){3}${OCTET}$`);
const IPV4_CIDR = new RegExp(
  `^(?:${OCTET}\\.){3}${OCTET}/(?:[0-9]|[1-2][0-9]|3[0-2])$`,
);

export type NetworkType = 'lan' | 'wan' | 'unknown';

export interface IPValidationResult {
  allowed: boolean;
  reason?: string;
  stopCode?: string;
}

export interface NetworkPolicy {
  networkPolicy: 'lan' | 'wan' | 'both';
  ipAccessPolicy: 'all' | 'restricted';
  allowedIPs: string[];
}

/**
 * IP Validation Service
 *
 * Handles IP address validation, CIDR matching, and network policy enforcement.
 * Supports both IPv4 and IPv6 addresses.
 */
@Injectable()
export class IPValidationService {
  private readonly logger = new Logger(IPValidationService.name);

  /** Validates if an IPv4 address is in valid format (a leading zero is rejected as ambiguous) */
  isValidIPv4(ip: string): boolean {
    return IPV4.test(ip.trim());
  }

  /** Validates if an IPv6 address is in valid format (zone index, e.g. "%eth0", is accepted) */
  isValidIPv6(ip: string): boolean {
    return net.isIPv6(ip.trim());
  }

  /** Validates if an address is a valid IPv4 or IPv6 address */
  isValidIP(ip: string): boolean {
    return this.isValidIPv4(ip) || this.isValidIPv6(ip);
  }

  /** Validates if a CIDR notation is in valid IPv4 format */
  isValidCIDR(cidr: string): boolean {
    return IPV4_CIDR.test(cidr.trim());
  }

  /** Validates if a CIDR notation is in valid IPv6 format */
  isValidCIDRv6(cidr: string): boolean {
    const trimmed = cidr.trim();
    const slashIndex = trimmed.lastIndexOf('/');
    if (slashIndex === -1) return false;

    const address = trimmed.slice(0, slashIndex);
    const prefixText = trimmed.slice(slashIndex + 1);
    if (!/^\d+$/.test(prefixText)) return false;

    const prefix = Number(prefixText);
    return prefix >= 0 && prefix <= 128 && this.isValidIPv6(address);
  }

  /**
   * Normalizes an IPv4-mapped IPv6 address (e.g. "::ffff:192.0.2.1") to its
   * plain IPv4 form, so a dual-stack client is classified consistently
   * regardless of which form it arrives in. Any other address (IPv4 or
   * "real" IPv6) is returned trimmed and otherwise unchanged.
   */
  normalizeIP(ip: string): string {
    const trimmed = ip.trim();
    if (!this.isValidIPv6(trimmed)) return trimmed;

    const value = this.ipv6ToBigInt(trimmed);
    const isIPv4Mapped = value >> 32n === 0xffffn;
    if (!isIPv4Mapped) return trimmed;

    const ipv4Value = Number(value & 0xffffffffn);
    const octets = [24, 16, 8, 0].map((shift) => (ipv4Value >>> shift) & 0xff);
    return octets.join('.');
  }

  /** Checks if an IP address is in a private range (LAN) */
  isPrivateIP(ip: string): boolean {
    const normalized = this.normalizeIP(ip);

    if (this.isValidIPv4(normalized)) {
      const parts = normalized.split('.').map(Number);
      const [a, b] = parts;
      return (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 127
      );
    }

    if (this.isValidIPv6(normalized)) {
      // ::1/128 (loopback), fc00::/7 (unique local), fe80::/10 (link-local)
      return (
        this.isIPInCIDR(normalized, '::1/128') ||
        this.isIPInCIDR(normalized, 'fc00::/7') ||
        this.isIPInCIDR(normalized, 'fe80::/10')
      );
    }

    return false;
  }

  /** Determines the network type (LAN/WAN) of an IP address */
  getNetworkType(ip: string): NetworkType {
    if (!this.isValidIP(ip)) return 'unknown';
    return this.isPrivateIP(ip) ? 'lan' : 'wan';
  }

  /** Converts an IPv4 address to a numeric value for comparison */
  private ipToNumber(ip: string): number {
    return (
      ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>>
      0
    );
  }

  /** Strips the zone index (e.g. "%eth0") from an IPv6 address, if present */
  private stripZoneIndex(ip: string): string {
    const percentIndex = ip.indexOf('%');
    return percentIndex === -1 ? ip : ip.slice(0, percentIndex);
  }

  /** Expands a trailing embedded IPv4 dotted-quad (e.g. "192.0.2.1") into two hex groups */
  private expandEmbeddedIPv4(groups: string[]): string[] {
    if (groups.length === 0) return groups;
    const last = groups[groups.length - 1];
    if (!last.includes('.')) return groups;

    const octets = last.split('.').map(Number);
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    return [...groups.slice(0, -1), hi, lo];
  }

  /** Converts a validated IPv6 address to its 128-bit numeric value */
  private ipv6ToBigInt(ip: string): bigint {
    const address = this.stripZoneIndex(ip.trim());
    const parts = address.split('::');
    let groups: string[];

    if (parts.length === 2) {
      const [head, tail] = parts;
      const headGroups = head ? head.split(':') : [];
      const tailGroups = this.expandEmbeddedIPv4(tail ? tail.split(':') : []);
      const missing = 8 - (headGroups.length + tailGroups.length);
      const zeroGroups = Array<string>(missing).fill('0');
      groups = [...headGroups, ...zeroGroups, ...tailGroups];
    } else {
      groups = this.expandEmbeddedIPv4(address.split(':'));
    }

    return groups.reduce(
      (acc, group) => (acc << 16n) | BigInt(parseInt(group || '0', 16)),
      0n,
    );
  }

  /** Builds a 32-bit network mask for the given IPv4 CIDR prefix length */
  private prefixToMask(prefix: number): number {
    return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  }

  /** Builds a 128-bit network mask for the given IPv6 CIDR prefix length */
  private ipv6Mask(prefixLength: number): bigint {
    const fullMask = (1n << 128n) - 1n;
    const hostBits = BigInt(128 - prefixLength);
    return fullMask ^ ((1n << hostBits) - 1n);
  }

  /** Checks if an IP address is within a CIDR range (IPv4 or IPv6) */
  isIPInCIDR(ip: string, cidr: string): boolean {
    const normalizedIP = this.normalizeIP(ip);
    const trimmedCidr = cidr.trim();

    if (this.isValidIPv4(normalizedIP)) {
      if (!this.isValidCIDR(trimmedCidr)) return false;
      const [network, prefixLength] = trimmedCidr.split('/');
      const ipNum = this.ipToNumber(normalizedIP);
      const networkNum = this.ipToNumber(network);
      const mask = this.prefixToMask(parseInt(prefixLength));
      return (ipNum & mask) === (networkNum & mask);
    }

    if (this.isValidIPv6(normalizedIP)) {
      if (!this.isValidCIDRv6(trimmedCidr)) return false;
      const slashIndex = trimmedCidr.lastIndexOf('/');
      const network = trimmedCidr.slice(0, slashIndex);
      const prefixLength = Number(trimmedCidr.slice(slashIndex + 1));
      const mask = this.ipv6Mask(prefixLength);
      return (
        (this.ipv6ToBigInt(normalizedIP) & mask) ===
        (this.ipv6ToBigInt(network) & mask)
      );
    }

    return false;
  }

  /** Checks if client IP is in allowed list (supports IPv4/IPv6 addresses and CIDR ranges) */
  isIPInAllowedList(clientIP: string, allowedIPs: string[]): boolean {
    const normalizedClientIP = this.normalizeIP(clientIP);
    if (!this.isValidIP(normalizedClientIP)) return false;
    if (!allowedIPs.length) return true;

    for (const allowed of allowedIPs) {
      const trimmed = allowed.trim();
      if (this.isValidIP(trimmed)) {
        if (normalizedClientIP === this.normalizeIP(trimmed)) return true;
      } else if (this.isValidCIDR(trimmed) || this.isValidCIDRv6(trimmed)) {
        if (this.isIPInCIDR(normalizedClientIP, trimmed)) return true;
      }
    }
    return false;
  }

  /** Validates IP access based on network policy and allowed IP list */
  validateIPAccess(
    clientIP: string,
    policy: NetworkPolicy,
    messages: {
      lanOnly?: string;
      wanOnly?: string;
      notAllowed?: string;
    } = {},
  ): IPValidationResult {
    if (!clientIP || !this.isValidIP(clientIP)) {
      return {
        allowed: false,
        reason: 'Invalid or missing client IP address',
      };
    }

    const networkType = this.getNetworkType(clientIP);
    if (policy.networkPolicy === 'lan' && networkType !== 'lan') {
      return {
        allowed: false,
        reason: messages.lanOnly || 'Only LAN access is allowed',
        stopCode: 'IP_POLICY_LAN_ONLY',
      };
    }

    if (policy.networkPolicy === 'wan' && networkType !== 'wan') {
      return {
        allowed: false,
        reason: messages.wanOnly || 'Only WAN access is allowed',
        stopCode: 'IP_POLICY_WAN_ONLY',
      };
    }

    if (policy.ipAccessPolicy === 'restricted') {
      if (!this.isIPInAllowedList(clientIP, policy.allowedIPs)) {
        return {
          allowed: false,
          reason:
            messages.notAllowed ||
            'Your current IP address is not in the allowed list',
          stopCode: 'IP_POLICY_NOT_ALLOWED',
        };
      }
    }

    return { allowed: true };
  }
}
