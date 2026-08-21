import {
  isValidIPv4,
  isValidCIDR,
  isValidIPOrCIDR,
  isPrivateIP,
  getNetworkType,
  isIPAllowed,
  isIPInCIDR,
  numberToIP,
  getCIDRInfo,
  validateIPAccess,
  formatIPForDisplay,
} from "./ipUtils";

describe("isValidIPv4", () => {
  it.each(["0.0.0.0", "10.0.0.1", "192.168.1.1", "255.255.255.255"])(
    "accepts %s",
    (ip) => expect(isValidIPv4(ip)).toBe(true),
  );

  it("tolerates surrounding whitespace", () => {
    expect(isValidIPv4("  192.168.1.1  ")).toBe(true);
  });

  it.each([
    "256.1.1.1",
    "1.2.3",
    "1.2.3.4.5",
    "abc",
    "",
    "192.168.1.-1",
    "192.168.1.1/24",
  ])("rejects %s", (ip) => expect(isValidIPv4(ip)).toBe(false));
});

describe("isValidCIDR", () => {
  it.each(["10.0.0.0/8", "192.168.1.0/24", "0.0.0.0/0", "1.2.3.4/32"])(
    "accepts %s",
    (cidr) => expect(isValidCIDR(cidr)).toBe(true),
  );

  it.each(["192.168.1.0/33", "192.168.1.0", "256.0.0.0/8", "10.0.0.0/"])(
    "rejects %s",
    (cidr) => expect(isValidCIDR(cidr)).toBe(false),
  );
});

describe("isValidIPOrCIDR", () => {
  it("accepts a bare IP", () => expect(isValidIPOrCIDR("8.8.8.8")).toBe(true));
  it("accepts a CIDR", () => expect(isValidIPOrCIDR("10.0.0.0/8")).toBe(true));
  it("rejects garbage", () => expect(isValidIPOrCIDR("nope")).toBe(false));
});

describe("isPrivateIP", () => {
  it.each(["10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "127.0.0.1"])(
    "treats %s as private",
    (ip) => expect(isPrivateIP(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "172.15.0.1", "172.32.0.1", "192.169.1.1", "1.1.1.1"])(
    "treats %s as public",
    (ip) => expect(isPrivateIP(ip)).toBe(false),
  );

  it("returns false for an invalid address", () => {
    expect(isPrivateIP("not-an-ip")).toBe(false);
  });
});

describe("getNetworkType", () => {
  it("classifies private addresses as lan", () => {
    expect(getNetworkType("192.168.0.5")).toBe("lan");
  });

  it("classifies public addresses as wan", () => {
    expect(getNetworkType("8.8.8.8")).toBe("wan");
  });

  it("classifies invalid addresses as unknown", () => {
    expect(getNetworkType("999.0.0.1")).toBe("unknown");
  });
});

describe("isIPInCIDR", () => {
  it("matches an address inside the range", () => {
    expect(isIPInCIDR("192.168.1.55", "192.168.1.0/24")).toBe(true);
  });

  it("rejects an address outside the range", () => {
    expect(isIPInCIDR("192.168.2.55", "192.168.1.0/24")).toBe(false);
  });

  it("matches everything for a /0", () => {
    expect(isIPInCIDR("8.8.8.8", "0.0.0.0/0")).toBe(true);
  });

  it("matches only the exact host for a /32", () => {
    expect(isIPInCIDR("10.1.2.3", "10.1.2.3/32")).toBe(true);
    expect(isIPInCIDR("10.1.2.4", "10.1.2.3/32")).toBe(false);
  });

  it("handles the high bit without sign errors", () => {
    expect(isIPInCIDR("200.0.0.1", "200.0.0.0/8")).toBe(true);
  });

  it("returns false for malformed input", () => {
    expect(isIPInCIDR("bad", "10.0.0.0/8")).toBe(false);
    expect(isIPInCIDR("10.0.0.1", "bad")).toBe(false);
  });
});

describe("isIPAllowed", () => {
  it("allows any valid IP when the list is empty", () => {
    expect(isIPAllowed("8.8.8.8", [])).toBe(true);
  });

  it("matches an exact entry", () => {
    expect(isIPAllowed("8.8.8.8", ["1.1.1.1", "8.8.8.8"])).toBe(true);
  });

  it("matches a CIDR entry", () => {
    expect(isIPAllowed("10.4.5.6", ["10.0.0.0/8"])).toBe(true);
  });

  it("ignores whitespace around entries", () => {
    expect(isIPAllowed("8.8.8.8", ["  8.8.8.8  "])).toBe(true);
  });

  it("skips unparseable entries", () => {
    expect(isIPAllowed("8.8.8.8", ["garbage", "8.8.8.8"])).toBe(true);
    expect(isIPAllowed("8.8.8.8", ["garbage"])).toBe(false);
  });

  it("rejects when nothing matches", () => {
    expect(isIPAllowed("8.8.8.8", ["1.1.1.1", "10.0.0.0/8"])).toBe(false);
  });

  it("rejects an invalid client IP even with an empty list", () => {
    expect(isIPAllowed("nope", [])).toBe(false);
  });
});

describe("numberToIP", () => {
  it("converts zero", () => expect(numberToIP(0)).toBe("0.0.0.0"));
  it("converts the max value", () =>
    expect(numberToIP(0xffffffff)).toBe("255.255.255.255"));
  it("round-trips a known address", () =>
    expect(numberToIP(3232235777)).toBe("192.168.1.1"));
});

describe("getCIDRInfo", () => {
  it("describes a /24", () => {
    expect(getCIDRInfo("192.168.1.0/24")).toEqual({
      network: "192.168.1.0",
      broadcast: "192.168.1.255",
      firstHost: "192.168.1.1",
      lastHost: "192.168.1.254",
      totalHosts: 254,
    });
  });

  it("normalizes a non-network address to its network", () => {
    expect(getCIDRInfo("192.168.1.130/24")?.network).toBe("192.168.1.0");
  });

  it("never reports negative hosts for a /32", () => {
    expect(getCIDRInfo("10.0.0.1/32")?.totalHosts).toBe(0);
  });

  it("returns null for invalid input", () => {
    expect(getCIDRInfo("192.168.1.0")).toBeNull();
  });
});

describe("validateIPAccess", () => {
  it("rejects a malformed address", () => {
    expect(validateIPAccess("nope")).toEqual({
      allowed: false,
      reason: "Invalid IP address format",
    });
  });

  it("allows anything under the default policy", () => {
    expect(validateIPAccess("8.8.8.8")).toEqual({ allowed: true });
  });

  it("blocks a WAN address under a lan-only policy", () => {
    expect(validateIPAccess("8.8.8.8", "lan")).toEqual({
      allowed: false,
      reason: "Only LAN access is allowed",
    });
  });

  it("permits a LAN address under a lan-only policy", () => {
    expect(validateIPAccess("192.168.1.10", "lan")).toEqual({ allowed: true });
  });

  it("blocks a LAN address under a wan-only policy", () => {
    expect(validateIPAccess("192.168.1.10", "wan")).toEqual({
      allowed: false,
      reason: "Only WAN access is allowed",
    });
  });

  it("permits a WAN address under a wan-only policy", () => {
    expect(validateIPAccess("8.8.8.8", "wan")).toEqual({ allowed: true });
  });

  it("enforces the allow list when restricted", () => {
    expect(validateIPAccess("8.8.8.8", "both", "restricted", ["1.1.1.1"])).toEqual(
      { allowed: false, reason: "IP address not in allowed list" },
    );
  });

  it("permits a listed address when restricted", () => {
    expect(
      validateIPAccess("8.8.8.8", "both", "restricted", ["8.8.8.8"]),
    ).toEqual({ allowed: true });
  });
});

describe("formatIPForDisplay", () => {
  it("labels an empty value", () => {
    expect(formatIPForDisplay("")).toBe("Unknown");
  });

  it("annotates a CIDR with its host count", () => {
    expect(formatIPForDisplay("192.168.1.0/24")).toBe("192.168.1.0/24 (254 hosts)");
  });

  it("annotates a LAN address", () => {
    expect(formatIPForDisplay("192.168.1.5")).toBe("192.168.1.5 (LAN)");
  });

  it("annotates a WAN address", () => {
    expect(formatIPForDisplay("8.8.8.8")).toBe("8.8.8.8 (WAN)");
  });

  it("passes through anything unrecognized", () => {
    expect(formatIPForDisplay("hostname.local")).toBe("hostname.local");
  });
});
