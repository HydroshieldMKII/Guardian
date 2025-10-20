/**
 * Utility functions for IP address validation, range parsing, and network type detection
 */

/**
 * Validates if a string is a valid IPv4 address
 */
export const isValidIPv4 = (ip: string): boolean => {
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip.trim());
};

/**
 * Validates if a string is a valid CIDR notation (IP/subnet)
 */
export const isValidCIDR = (cidr: string): boolean => {
  const cidrRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
  return cidrRegex.test(cidr.trim());
};

/**
 * Validates if a string is either a valid IP address or CIDR range
 */
export const isValidIPOrCIDR = (input: string): boolean => {
  const trimmed = input.trim();
  return isValidIPv4(trimmed) || isValidCIDR(trimmed);
};

/**
 * Determines if an IP address is in a private/local network range
 */
export const isPrivateIP = (ip: string): boolean => {
  if (!isValidIPv4(ip)) return false;

  const parts = ip.split(".").map(Number);
  const [a, b, c] = parts;

  // Private IP ranges:
  // 10.0.0.0/8 (10.0.0.0 – 10.255.255.255)
  // 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
  // 192.168.0.0/16 (192.168.0.0 – 192.168.255.255)
  // 127.0.0.0/8 (localhost)
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127
  );
};

/**
 * Determines the network type of an IP address
 */
export const getNetworkType = (ip: string): "lan" | "wan" | "unknown" => {
  if (!isValidIPv4(ip)) return "unknown";
  return isPrivateIP(ip) ? "lan" : "wan";
};

/**
 * Checks if an IP address matches any of the allowed IPs/ranges
 */
export const isIPAllowed = (
  clientIP: string,
  allowedIPs: string[],
): boolean => {
  if (!isValidIPv4(clientIP)) return false;
  if (!allowedIPs.length) return true; // If no restrictions, allow all

  for (const allowed of allowedIPs) {
    const trimmed = allowed.trim();

    if (isValidIPv4(trimmed)) {
      // Exact IP match
      if (clientIP === trimmed) return true;
    } else if (isValidCIDR(trimmed)) {
      // CIDR range match
      if (isIPInCIDR(clientIP, trimmed)) return true;
    }
  }

  return false;
};

/**
 * Checks if an IP address is within a CIDR range
 */
export const isIPInCIDR = (ip: string, cidr: string): boolean => {
  if (!isValidIPv4(ip) || !isValidCIDR(cidr)) return false;

  const [network, prefixLength] = cidr.split("/");
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
};

/**
 * Converts an IP address string to a 32-bit number
 */
const ipToNumber = (ip: string): number => {
  return (
    ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
  );
};

/**
 * Converts a 32-bit number back to an IP address string
 */
export const numberToIP = (num: number): string => {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join(".");
};

/**
 * Gets the network address and broadcast address for a CIDR range
 */
export const getCIDRInfo = (
  cidr: string,
): {
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
} | null => {
  if (!isValidCIDR(cidr)) return null;

  const [network, prefixLength] = cidr.split("/");
  const prefix = parseInt(prefixLength);
  const networkNum = ipToNumber(network);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const networkAddress = networkNum & mask;
  const broadcastAddress = networkAddress | (~mask >>> 0);
  const totalHosts = Math.pow(2, 32 - prefix);

  return {
    network: numberToIP(networkAddress),
    broadcast: numberToIP(broadcastAddress),
    firstHost: numberToIP(networkAddress + 1),
    lastHost: numberToIP(broadcastAddress - 1),
    totalHosts: Math.max(0, totalHosts - 2), // Subtract network and broadcast addresses
  };
};

/**
 * Validates access based on network policy and IP restrictions
 */
export const validateIPAccess = (
  clientIP: string,
  networkPolicy: "both" | "lan" | "wan" = "both",
  ipAccessPolicy: "all" | "restricted" = "all",
  allowedIPs: string[] = [],
): { allowed: boolean; reason?: string } => {
  // First check if IP is valid
  if (!isValidIPv4(clientIP)) {
    return { allowed: false, reason: "Invalid IP address format" };
  }

  const networkType = getNetworkType(clientIP);

  // Check network policy
  if (networkPolicy === "lan" && networkType !== "lan") {
    return { allowed: false, reason: "Only LAN access is allowed" };
  }
  if (networkPolicy === "wan" && networkType !== "wan") {
    return { allowed: false, reason: "Only WAN access is allowed" };
  }

  // Check IP access policy
  if (ipAccessPolicy === "all") {
    return { allowed: true };
  }

  if (ipAccessPolicy === "restricted") {
    if (!isIPAllowed(clientIP, allowedIPs)) {
      return { allowed: false, reason: "IP address not in allowed list" };
    }
  }

  return { allowed: true };
};

/**
 * Formats an IP address for display (adds CIDR info if applicable)
 */
export const formatIPForDisplay = (ip: string): string => {
  if (!ip) return "Unknown";

  if (isValidCIDR(ip)) {
    const cidrInfo = getCIDRInfo(ip);
    if (cidrInfo) {
      return `${ip} (${cidrInfo.totalHosts} hosts)`;
    }
  }

  if (isValidIPv4(ip)) {
    const networkType = getNetworkType(ip);
    return `${ip} (${networkType.toUpperCase()})`;
  }

  return ip;
};
