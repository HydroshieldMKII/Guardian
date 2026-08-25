const IPV6_GROUP = /^[0-9a-fA-F]{1,4}$/;

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^(?:${OCTET}\\.){3}${OCTET}$`);
const IPV4_CIDR = new RegExp(
  `^(?:${OCTET}\\.){3}${OCTET}/(?:[0-9]|[1-2][0-9]|3[0-2])$`,
);

export const isValidIPv4 = (ip: string): boolean => IPV4.test(ip.trim());

const stripZoneIndex = (ip: string): string | null => {
  const percentIndex = ip.indexOf("%");
  if (percentIndex === -1) return ip;

  const zone = ip.slice(percentIndex + 1);
  if (!zone || zone.includes("%")) return null;

  return ip.slice(0, percentIndex);
};

const expandEmbeddedIPv4 = (groups: string[]): string[] | null => {
  const last = groups[groups.length - 1];
  if (!last.includes(".")) return groups;
  if (!isValidIPv4(last)) return null;

  const octets = last.split(".").map(Number);
  const hi = ((octets[0] << 8) | octets[1]).toString(16);
  const lo = ((octets[2] << 8) | octets[3]).toString(16);
  return [...groups.slice(0, -1), hi, lo];
};

const parseIPv6Groups = (ip: string): number[] | null => {
  const address = stripZoneIndex(ip.trim());
  if (!address) return null;

  const halves = address.split("::");
  if (halves.length > 2) return null;

  const compressed = halves.length === 2;
  let head = halves[0] ? halves[0].split(":") : [];
  let tail = compressed && halves[1] ? halves[1].split(":") : [];

  if (compressed && tail.length > 0) {
    const expanded = expandEmbeddedIPv4(tail);
    if (expanded === null) return null;
    tail = expanded;
  } else if (!compressed) {
    const expanded = expandEmbeddedIPv4(head);
    if (expanded === null) return null;
    head = expanded;
  }

  const present = [...head, ...tail];
  if (!present.every((group) => IPV6_GROUP.test(group))) return null;

  if (compressed) {
    if (present.length > 7) return null;
    const zeros = new Array<string>(8 - present.length).fill("0");
    return [...head, ...zeros, ...tail].map((group) => parseInt(group, 16));
  }

  if (present.length !== 8) return null;
  return present.map((group) => parseInt(group, 16));
};

export const isValidIPv6 = (ip: string): boolean =>
  parseIPv6Groups(ip) !== null;

export const isValidIP = (ip: string): boolean =>
  isValidIPv4(ip) || isValidIPv6(ip);

export const isValidCIDR = (cidr: string): boolean =>
  IPV4_CIDR.test(cidr.trim());

const cidrPrefixLength = (cidr: string, maxPrefix: number): number | null => {
  const slashIndex = cidr.lastIndexOf("/");
  if (slashIndex === -1) return null;

  const prefixText = cidr.slice(slashIndex + 1);
  if (!/^\d+$/.test(prefixText)) return null;

  const prefix = Number(prefixText);
  return prefix <= maxPrefix ? prefix : null;
};

export const isValidCIDRv6 = (cidr: string): boolean => {
  const trimmed = cidr.trim();
  if (cidrPrefixLength(trimmed, 128) === null) return false;

  return isValidIPv6(trimmed.slice(0, trimmed.lastIndexOf("/")));
};

export const isValidIPOrCIDR = (input: string): boolean => {
  const trimmed = input.trim();
  return isValidIP(trimmed) || isValidCIDR(trimmed) || isValidCIDRv6(trimmed);
};

export const normalizeIP = (ip: string): string => {
  const trimmed = ip.trim();
  const groups = parseIPv6Groups(trimmed);
  if (!groups) return trimmed;

  const isIPv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (!isIPv4Mapped) return trimmed;

  return [
    (groups[6] >> 8) & 0xff,
    groups[6] & 0xff,
    (groups[7] >> 8) & 0xff,
    groups[7] & 0xff,
  ].join(".");
};

const PRIVATE_IPV6_RANGES = ["::1/128", "fc00::/7", "fe80::/10"];

export const isPrivateIP = (ip: string): boolean => {
  const normalized = normalizeIP(ip);

  if (isValidIPv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127
    );
  }

  if (isValidIPv6(normalized)) {
    return PRIVATE_IPV6_RANGES.some((range) => isIPInCIDR(normalized, range));
  }

  return false;
};

export const getNetworkType = (ip: string): "lan" | "wan" | "unknown" => {
  if (!isValidIP(ip)) return "unknown";
  return isPrivateIP(ip) ? "lan" : "wan";
};

export const isIPAllowed = (
  clientIP: string,
  allowedIPs: string[],
): boolean => {
  const normalizedClientIP = normalizeIP(clientIP);
  if (!isValidIP(normalizedClientIP)) return false;
  if (!allowedIPs.length) return true;

  for (const allowed of allowedIPs) {
    const trimmed = allowed.trim();

    if (isValidIP(trimmed)) {
      if (normalizedClientIP === normalizeIP(trimmed)) return true;
    } else if (isValidCIDR(trimmed) || isValidCIDRv6(trimmed)) {
      if (isIPInCIDR(normalizedClientIP, trimmed)) return true;
    }
  }

  return false;
};

const ipv6PrefixMatches = (
  a: number[],
  b: number[],
  prefixLength: number,
): boolean => {
  for (let index = 0; index < 8; index++) {
    const bits = Math.min(16, Math.max(0, prefixLength - index * 16));
    const mask = bits === 0 ? 0 : (0xffff << (16 - bits)) & 0xffff;
    if ((a[index] & mask) !== (b[index] & mask)) return false;
  }
  return true;
};

export const isIPInCIDR = (ip: string, cidr: string): boolean => {
  const normalizedIP = normalizeIP(ip);
  const trimmedCIDR = cidr.trim();

  if (isValidIPv4(normalizedIP)) {
    if (!isValidCIDR(trimmedCIDR)) return false;

    const [network, prefixLength] = trimmedCIDR.split("/");
    const mask = prefixToMask(parseInt(prefixLength));

    return (
      (ipToNumber(normalizedIP) & mask) === (ipToNumber(network) & mask)
    );
  }

  const prefixLength = cidrPrefixLength(trimmedCIDR, 128);
  if (prefixLength === null) return false;

  const address = parseIPv6Groups(normalizedIP);
  const network = parseIPv6Groups(
    trimmedCIDR.slice(0, trimmedCIDR.lastIndexOf("/")),
  );
  if (!address || !network) return false;

  return ipv6PrefixMatches(address, network, prefixLength);
};

const ipToNumber = (ip: string): number =>
  ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

const prefixToMask = (prefix: number): number =>
  prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

export const numberToIP = (num: number): string =>
  [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join(
    ".",
  );

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
  const mask = prefixToMask(prefix);
  const networkAddress = ipToNumber(network) & mask;
  const broadcastAddress = networkAddress | (~mask >>> 0);

  return {
    network: numberToIP(networkAddress),
    broadcast: numberToIP(broadcastAddress),
    firstHost: numberToIP(networkAddress + 1),
    lastHost: numberToIP(broadcastAddress - 1),
    totalHosts: Math.max(0, Math.pow(2, 32 - prefix) - 2),
  };
};

export const validateIPAccess = (
  clientIP: string,
  networkPolicy: "both" | "lan" | "wan" = "both",
  ipAccessPolicy: "all" | "restricted" = "all",
  allowedIPs: string[] = [],
): { allowed: boolean; reason?: string } => {
  if (!isValidIP(clientIP)) {
    return { allowed: false, reason: "Invalid IP address format" };
  }

  const networkType = getNetworkType(clientIP);

  if (networkPolicy === "lan" && networkType !== "lan") {
    return { allowed: false, reason: "Only LAN access is allowed" };
  }
  if (networkPolicy === "wan" && networkType !== "wan") {
    return { allowed: false, reason: "Only WAN access is allowed" };
  }

  if (ipAccessPolicy === "all") {
    return { allowed: true };
  }

  if (!isIPAllowed(clientIP, allowedIPs)) {
    return { allowed: false, reason: "IP address not in allowed list" };
  }

  return { allowed: true };
};

export const formatIPForDisplay = (ip: string): string => {
  if (!ip) return "Unknown";

  const cidrInfo = getCIDRInfo(ip);
  if (cidrInfo) {
    return `${ip} (${cidrInfo.totalHosts} hosts)`;
  }

  if (isValidCIDRv6(ip)) {
    return ip;
  }

  if (isValidIP(ip)) {
    return `${ip} (${getNetworkType(ip).toUpperCase()})`;
  }

  return ip;
};
