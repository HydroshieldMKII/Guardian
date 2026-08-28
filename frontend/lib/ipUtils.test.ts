import {
  isValidIPv4,
  isValidIPv6,
  isValidIP,
  isValidCIDR,
  isValidCIDRv6,
  isValidIPOrCIDR,
  normalizeIP,
  isPrivateIP,
  getNetworkType,
  isIPAllowed,
  isIPInCIDR,
  numberToIP,
  getCIDRInfo,
  validateIPAccess,
  formatIPForDisplay,
} from "@/lib/ipUtils";

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
  it.each([
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "127.0.0.1",
  ])("treats %s as private", (ip) => expect(isPrivateIP(ip)).toBe(true));

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
      reason: "This is not a valid IP address",
    });
  });

  it("allows anything under the default policy", () => {
    expect(validateIPAccess("8.8.8.8")).toEqual({ allowed: true });
  });

  it("blocks a WAN address under a lan-only policy", () => {
    expect(validateIPAccess("8.8.8.8", "lan")).toEqual({
      allowed: false,
      reason: "Streaming is only allowed on the local network",
    });
  });

  it("permits a LAN address under a lan-only policy", () => {
    expect(validateIPAccess("192.168.1.10", "lan")).toEqual({ allowed: true });
  });

  it("blocks a LAN address under a wan-only policy", () => {
    expect(validateIPAccess("192.168.1.10", "wan")).toEqual({
      allowed: false,
      reason: "Streaming is only allowed from the internet",
    });
  });

  it("permits a WAN address under a wan-only policy", () => {
    expect(validateIPAccess("8.8.8.8", "wan")).toEqual({ allowed: true });
  });

  it("enforces the allow list when restricted", () => {
    expect(
      validateIPAccess("8.8.8.8", "both", "restricted", ["1.1.1.1"]),
    ).toEqual({ allowed: false, reason: "This IP address is not on the allowed list" });
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
    expect(formatIPForDisplay("192.168.1.0/24")).toBe(
      "192.168.1.0/24 (254 hosts)",
    );
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

describe("isValidIPv6", () => {
  it.each([
    "::",
    "::1",
    "2001:db8::1",
    "2001:0db8:0000:0000:0000:0000:0000:0001",
    "fe80::1%eth0",
    "::ffff:192.0.2.1",
    "::ffff:c000:0201",
    "1:2:3:4:5:6:7:8",
    "1:2:3:4:5:6:1.2.3.4",
    "ABCD::EF01",
  ])("accepts %s", (ip) => expect(isValidIPv6(ip)).toBe(true));

  it.each([
    "1.2.3.4",
    "1:2:3:4:5:6:7",
    "1:2:3:4:5:6:7:8:9",
    ":::",
    ":1:2:3:4:5:6:7",
    "1:2:3:4:5:6:7:",
    "1::2::3",
    "12345::",
    "g::1",
    "",
    "%eth0",
  ])("rejects %s", (ip) => expect(isValidIPv6(ip)).toBe(false));
});

describe("isValidIP", () => {
  it("accepts either family", () => {
    expect(isValidIP("8.8.8.8")).toBe(true);
    expect(isValidIP("2001:db8::1")).toBe(true);
  });

  it("rejects garbage", () => expect(isValidIP("nope")).toBe(false));
});

describe("isValidCIDRv6", () => {
  it.each(["2001:db8::/32", "::/0", "::1/128", "fe80::/10"])(
    "accepts %s",
    (cidr) => expect(isValidCIDRv6(cidr)).toBe(true),
  );

  it.each([
    "2001:db8::/129",
    "2001:db8::",
    "10.0.0.0/8",
    "2001:db8::/x",
    "/32",
  ])("rejects %s", (cidr) => expect(isValidCIDRv6(cidr)).toBe(false));
});

describe("normalizeIP", () => {
  it("reduces the dotted-quad form of an IPv4-mapped address", () => {
    expect(normalizeIP("::ffff:192.0.2.1")).toBe("192.0.2.1");
  });

  it("reduces the hex-group form of an IPv4-mapped address", () => {
    expect(normalizeIP("::ffff:c000:0201")).toBe("192.0.2.1");
  });

  it("leaves a plain IPv4 address alone", () => {
    expect(normalizeIP(" 10.0.0.1 ")).toBe("10.0.0.1");
  });

  it("leaves a non-mapped IPv6 address alone", () => {
    expect(normalizeIP("2001:db8::1")).toBe("2001:db8::1");
  });

  it("does not mistake an IPv4-translated address for a mapped one", () => {
    expect(normalizeIP("::ffff:0:1.2.3.4")).toBe("::ffff:0:1.2.3.4");
  });

  it("leaves an unparseable value alone", () => {
    expect(normalizeIP(" nope ")).toBe("nope");
  });
});

describe("isPrivateIP over IPv6", () => {
  it.each(["::1", "fc00::1", "fd12:3456:789a::1", "fe80::1", "fe80::1%eth0"])(
    "treats %s as private",
    (ip) => expect(isPrivateIP(ip)).toBe(true),
  );

  it.each(["2001:db8::1", "2606:4700:4700::1111"])(
    "treats %s as public",
    (ip) => expect(isPrivateIP(ip)).toBe(false),
  );
});

describe("isIPInCIDR over IPv6", () => {
  it("matches an address inside the range", () => {
    expect(isIPInCIDR("2001:db8::42", "2001:db8::/32")).toBe(true);
  });

  it("rejects an address outside the range", () => {
    expect(isIPInCIDR("2001:db9::1", "2001:db8::/32")).toBe(false);
  });

  it("matches only the exact host for a /128", () => {
    expect(isIPInCIDR("2001:db8::1", "2001:db8::1/128")).toBe(true);
    expect(isIPInCIDR("2001:db8::2", "2001:db8::1/128")).toBe(false);
  });

  it("discriminates on a prefix that splits a group", () => {
    expect(isIPInCIDR("fdff::1", "fc00::/7")).toBe(true);
    expect(isIPInCIDR("fe00::1", "fc00::/7")).toBe(false);
  });

  it("never matches across address families", () => {
    expect(isIPInCIDR("1.2.3.4", "2001:db8::/32")).toBe(false);
    expect(isIPInCIDR("2001:db8::1", "10.0.0.0/8")).toBe(false);
  });

  it.each(["2001:db8::", "2001:db8::/129", "2001:db8::/x", "garbage"])(
    "rejects the malformed range %p",
    (cidr) => expect(isIPInCIDR("2001:db8::1", cidr)).toBe(false),
  );
});

describe("isIPAllowed over IPv6", () => {
  it("matches an exact entry", () => {
    expect(isIPAllowed("2001:db8::1", ["2001:db8::1"])).toBe(true);
  });

  it("matches a CIDR entry", () => {
    expect(isIPAllowed("2001:db8::42", ["2001:db8::/32"])).toBe(true);
  });

  it("matches against a mixed-family list", () => {
    const list = ["10.0.0.0/8", "2001:db8::/32"];
    expect(isIPAllowed("10.1.2.3", list)).toBe(true);
    expect(isIPAllowed("2001:db8::9", list)).toBe(true);
    expect(isIPAllowed("8.8.8.8", list)).toBe(false);
  });

  it("rejects an address the list does not cover", () => {
    expect(isIPAllowed("2001:db9::1", ["2001:db8::/32"])).toBe(false);
  });
});

describe("formatIPForDisplay over IPv6", () => {
  it("annotates a public address", () => {
    expect(formatIPForDisplay("2001:db8::1")).toBe("2001:db8::1 (WAN)");
  });

  it("annotates a private address", () => {
    expect(formatIPForDisplay("fd00::1")).toBe("fd00::1 (LAN)");
  });

  it("passes a CIDR through without a meaningless host count", () => {
    expect(formatIPForDisplay("2001:db8::/32")).toBe("2001:db8::/32");
    expect(getCIDRInfo("2001:db8::/32")).toBeNull();
  });
});

describe("regressions that must never be reintroduced", () => {
  describe("issue #114 - IPv6 clients were rejected outright", () => {
    it("accepts an IPv6 address in the allowed-IPs form field", () => {
      expect(isValidIPOrCIDR("2001:db8::1")).toBe(true);
      expect(isValidIPOrCIDR("fe80::1%eth0")).toBe(true);
      expect(isValidIPOrCIDR("2001:db8::/32")).toBe(true);
    });

    it("reports a network type for IPv6 instead of a blank badge", () => {
      expect(getNetworkType("2001:db8::1")).toBe("wan");
      expect(getNetworkType("fd00::1")).toBe("lan");
      expect(getNetworkType("::1")).toBe("lan");
    });

    it("allows an IPv6 client under a permissive policy", () => {
      expect(validateIPAccess("2001:db8::1")).toEqual({ allowed: true });
      expect(validateIPAccess("fd00::1", "lan")).toEqual({ allowed: true });
    });
  });

  describe("a /0 prefix must match every address", () => {
    it("holds for IPv4, where a 32-bit shift silently wraps to a no-op", () => {
      expect(isIPInCIDR("8.8.8.8", "0.0.0.0/0")).toBe(true);
      expect(isIPAllowed("8.8.8.8", ["0.0.0.0/0"])).toBe(true);
      expect(
        validateIPAccess("8.8.8.8", "both", "restricted", ["0.0.0.0/0"]),
      ).toEqual({ allowed: true });
    });

    it("holds for IPv6", () => {
      expect(isIPInCIDR("2001:db8::1", "::/0")).toBe(true);
      expect(isIPAllowed("2001:db8::1", ["::/0"])).toBe(true);
    });
  });

  describe("an IPv4-mapped address must not launder its classification", () => {
    it("cannot slip a public address past a lan-only policy", () => {
      expect(validateIPAccess("::ffff:8.8.8.8", "lan")).toEqual({
        allowed: false,
        reason: "Streaming is only allowed on the local network",
      });
    });

    it("still recognises a mapped private address as lan", () => {
      expect(validateIPAccess("::ffff:192.168.1.5", "lan")).toEqual({
        allowed: true,
      });
    });

    it("matches a mapped client against a plain IPv4 allow entry", () => {
      expect(isIPAllowed("::ffff:8.8.8.8", ["8.8.8.8"])).toBe(true);
      expect(isIPAllowed("8.8.8.8", ["::ffff:8.8.8.8"])).toBe(true);
      expect(isIPAllowed("::ffff:10.1.2.3", ["10.0.0.0/8"])).toBe(true);
    });
  });

  describe("zero-padded octets are rejected as ambiguous", () => {
    it.each(["010.0.0.1", "01.2.3.4", "192.168.001.1", "00.0.0.0"])(
      "rejects %s, which another parser could read as octal",
      (ip) => {
        expect(isValidIPv4(ip)).toBe(false);
        expect(isValidIPOrCIDR(ip)).toBe(false);
      },
    );

    it("rejects a zero-padded CIDR range", () => {
      expect(isValidCIDR("010.0.0.0/8")).toBe(false);
      expect(isValidIPOrCIDR("010.0.0.0/8")).toBe(false);
    });

    it("keeps a zero-padded entry out of an allow list", () => {
      expect(isIPAllowed("10.0.0.1", ["010.0.0.1"])).toBe(false);
    });

    it("still accepts an unpadded zero octet", () => {
      expect(isValidIPv4("0.0.0.0")).toBe(true);
      expect(isValidIPv4("10.0.0.0")).toBe(true);
      expect(isValidCIDR("0.0.0.0/0")).toBe(true);
    });
  });

  describe("ambiguous IPv6 spellings stay rejected", () => {
    it("rejects a leading zero in an embedded IPv4 quad", () => {
      expect(isValidIPv6("::01.2.3.4")).toBe(false);
      expect(isValidIPOrCIDR("::010.1.1.1")).toBe(false);
    });

    it("rejects a :: that stands for no groups at all", () => {
      expect(isValidIPv6("1:2:3:4:5:6:7::8")).toBe(false);
      expect(isValidIPv6("1:2:3:4:5:6:7:8::")).toBe(false);
    });
  });
});
