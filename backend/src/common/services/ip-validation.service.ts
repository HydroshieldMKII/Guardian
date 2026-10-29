import { Injectable } from '@nestjs/common';
import * as net from 'net';
import { DEFAULT_BLOCK_MESSAGES } from '@/common/utils/block-messages';
import { StopCode } from '@/common/utils/stop-codes';

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^(?:${OCTET}\\.){3}${OCTET}$`);
const IPV4_CIDR = new RegExp(
  `^(?:${OCTET}\\.){3}${OCTET}/(?:[0-9]|[1-2][0-9]|3[0-2])$`,
);

export type NetworkType = 'lan' | 'wan' | 'unknown';

export interface IPValidationResult {
  allowed: boolean;
  reason?: string;
  stopCode?: StopCode;
}

export interface NetworkPolicy {
  networkPolicy: 'lan' | 'wan' | 'both';
  ipAccessPolicy: 'all' | 'restricted';
  allowedIPs: string[];
}

@Injectable()
export class IPValidationService {
  isValidIPv4(ip: string): boolean {
    return IPV4.test(ip.trim());
  }

  isValidIPv6(ip: string): boolean {
    return net.isIPv6(ip.trim());
  }

  isValidIP(ip: string): boolean {
    return this.isValidIPv4(ip) || this.isValidIPv6(ip);
  }

  isValidCIDR(cidr: string): boolean {
    return IPV4_CIDR.test(cidr.trim());
  }

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
      return (
        this.isIPInCIDR(normalized, '::1/128') ||
        this.isIPInCIDR(normalized, 'fc00::/7') ||
        this.isIPInCIDR(normalized, 'fe80::/10')
      );
    }

    return false;
  }

  getNetworkType(ip: string): NetworkType {
    if (!this.isValidIP(ip)) return 'unknown';
    return this.isPrivateIP(ip) ? 'lan' : 'wan';
  }

  private ipToNumber(ip: string): number {
    return (
      ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>>
      0
    );
  }

  private stripZoneIndex(ip: string): string {
    const percentIndex = ip.indexOf('%');
    return percentIndex === -1 ? ip : ip.slice(0, percentIndex);
  }

  private expandEmbeddedIPv4(groups: string[]): string[] {
    if (groups.length === 0) return groups;
    const last = groups[groups.length - 1];
    if (!last.includes('.')) return groups;

    const octets = last.split('.').map(Number);
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    return [...groups.slice(0, -1), hi, lo];
  }

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
      (acc, group) => (acc << 16n) | BigInt(parseInt(group, 16)),
      0n,
    );
  }

  private prefixToMask(prefix: number): number {
    return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  }

  private ipv6Mask(prefixLength: number): bigint {
    const fullMask = (1n << 128n) - 1n;
    const hostBits = BigInt(128 - prefixLength);
    return fullMask ^ ((1n << hostBits) - 1n);
  }

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
        reason: messages.lanOnly || DEFAULT_BLOCK_MESSAGES.lanOnly,
        stopCode: 'IP_POLICY_LAN_ONLY',
      };
    }

    if (policy.networkPolicy === 'wan' && networkType !== 'wan') {
      return {
        allowed: false,
        reason: messages.wanOnly || DEFAULT_BLOCK_MESSAGES.wanOnly,
        stopCode: 'IP_POLICY_WAN_ONLY',
      };
    }

    if (policy.ipAccessPolicy === 'restricted') {
      if (!this.isIPInAllowedList(clientIP, policy.allowedIPs)) {
        return {
          allowed: false,
          reason: messages.notAllowed || DEFAULT_BLOCK_MESSAGES.notAllowed,
          stopCode: 'IP_POLICY_NOT_ALLOWED',
        };
      }
    }

    return { allowed: true };
  }
}
