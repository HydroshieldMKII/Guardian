import { Injectable, Logger } from '@nestjs/common';

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
 */
@Injectable()
export class IPValidationService {
  private readonly logger = new Logger(IPValidationService.name);

  /** Validates if an IPv4 address is in valid format */
  isValidIPv4(ip: string): boolean {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip.trim());
  }

  /** Validates if a CIDR notation is in valid format */
  isValidCIDR(cidr: string): boolean {
    const cidrRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
    return cidrRegex.test(cidr.trim());
  }

  /** Checks if an IP address is in a private range (LAN) */
  isPrivateIP(ip: string): boolean {
    if (!this.isValidIPv4(ip)) return false;
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127
    );
  }

  /** Determines the network type (LAN/WAN) of an IP address */
  getNetworkType(ip: string): NetworkType {
    if (!this.isValidIPv4(ip)) return 'unknown';
    return this.isPrivateIP(ip) ? 'lan' : 'wan';
  }

  /** Converts IP address to numeric value for comparison */
  private ipToNumber(ip: string): number {
    return (
      ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>>
      0
    );
  }

  /** Checks if an IP address is within a CIDR range */
  isIPInCIDR(ip: string, cidr: string): boolean {
    if (!this.isValidIPv4(ip) || !this.isValidCIDR(cidr)) return false;
    const [network, prefixLength] = cidr.split('/');
    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(network);
    const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
    return (ipNum & mask) === (networkNum & mask);
  }

  /** Checks if client IP is in allowed list (supports IPs and CIDR ranges) */
  isIPInAllowedList(clientIP: string, allowedIPs: string[]): boolean {
    if (!this.isValidIPv4(clientIP)) return false;
    if (!allowedIPs.length) return true;

    for (const allowed of allowedIPs) {
      const trimmed = allowed.trim();
      if (this.isValidIPv4(trimmed)) {
        if (clientIP === trimmed) return true;
      } else if (this.isValidCIDR(trimmed)) {
        if (this.isIPInCIDR(clientIP, trimmed)) return true;
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
    if (!clientIP || !this.isValidIPv4(clientIP)) {
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
