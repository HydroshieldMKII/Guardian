import { isValidIPv4, isValidIPv6, normalizeIP } from "@/lib/ipUtils";
import { isIPv4, isIPv6 } from "net";

const corpus = [
  "::",
  "::1",
  "1::",
  "::8",
  "8::",
  "::ffff:192.0.2.1",
  "::ffff:c000:0201",
  "::ffff:0:255.255.255.255",
  "2001:db8::1",
  "2001:0db8:0000:0000:0000:0000:0000:0001",
  "2001:db8:85a3::8a2e:370:7334",
  "fe80::1%eth0",
  "fe80::1%25eth0",
  "fe80:0000:0000:0000:0202:b3ff:fe1e:8329",
  "0:0:0:0:0:0:0:0",
  "0000:0000:0000:0000:0000:0000:0000:0000",
  "1:2:3:4:5:6:7:8",
  "1:2:3:4:5:6::8",
  "1::2:3:4:5:6:7",
  "abcd::ef01",
  "ABCD::EF01",
  "::1.2.3.4",
  "1:2:3:4:5:6:1.2.3.4",
  "1:2:3:4:5:6:7:8:9",
  "1:2:3:4:5:6:7",
  "1:2:3:4:5:6:7:8::",
  "1:2:3:4:5:6:7::8",
  "1::2:3:4:5:6:7:8",
  "1:2:3:4:5:6:7:1.2.3.4",
  ":::",
  "::::",
  ":1:2:3:4:5:6:7",
  "1:2:3:4:5:6:7:",
  "1::2::3",
  "12345::",
  "g::1",
  "0x1::",
  "-1::",
  "1:-2::",
  "",
  " ",
  "1.2.3.4",
  "1.2.3.4::",
  "::1.2.3.256",
  "::01.2.3.4",
  "::00.1.2.3",
  "::ffff:192.0.2.300",
  "::%eth0",
  "%eth0",
];

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const pieces = [
  "1",
  "ffff",
  "0",
  "abcd",
  "",
  "12345",
  "g",
  "1.2.3.4",
  "01.2.3.4",
  "::",
  ":",
  "%eth0",
];

describe("isValidIPv6 agrees with the backend validator", () => {
  it.each(corpus)("agrees on %p", (input) => {
    expect(isValidIPv6(input)).toBe(isIPv6(input.trim()));
  });

  it("agrees across a deterministic sweep of generated input", () => {
    const random = seededRandom(20260825);
    const disagreements: string[] = [];

    for (let attempt = 0; attempt < 50000; attempt++) {
      const count = 1 + Math.floor(random() * 10);
      const separator = random() < 0.8 ? ":" : "";
      const candidate = Array.from(
        { length: count },
        () => pieces[Math.floor(random() * pieces.length)],
      ).join(separator);

      if (isValidIPv6(candidate) !== isIPv6(candidate.trim())) {
        disagreements.push(candidate);
      }
    }

    expect(disagreements.slice(0, 20)).toEqual([]);
  });
});

describe("isValidIPv4 agrees with the backend validator", () => {
  it.each([
    "0.0.0.0",
    "255.255.255.255",
    "10.0.0.1",
    "01.2.3.4",
    "010.0.0.1",
    "192.168.001.1",
    "00.0.0.0",
    "1.2.3.256",
    "1.2.3",
    "1.2.3.4.5",
    "1.2.3.-4",
    "1.2.3.1e2",
    "",
  ])("agrees on %p", (input) => {
    expect(isValidIPv4(input)).toBe(isIPv4(input.trim()));
  });

  it("agrees across a deterministic sweep of generated input", () => {
    const random = seededRandom(19700101);
    const octets = [
      "0",
      "00",
      "01",
      "010",
      "1",
      "9",
      "10",
      "99",
      "100",
      "199",
      "200",
      "249",
      "250",
      "255",
      "256",
      "300",
      "999",
      "",
      "a",
      "-1",
      "1e2",
    ];
    const disagreements: string[] = [];

    for (let attempt = 0; attempt < 50000; attempt++) {
      const count = 1 + Math.floor(random() * 5);
      const candidate = Array.from(
        { length: count },
        () => octets[Math.floor(random() * octets.length)],
      ).join(".");

      if (isValidIPv4(candidate) !== isIPv4(candidate.trim())) {
        disagreements.push(candidate);
      }
    }

    expect(disagreements.slice(0, 20)).toEqual([]);
  });
});

describe("normalizeIP agrees with the backend on address family", () => {
  it.each(corpus.filter((entry) => isIPv6(entry.trim())))(
    "keeps %p a valid address after normalizing",
    (input) => {
      const normalized = normalizeIP(input);
      expect(
        isIPv6(normalized) || /^\d+\.\d+\.\d+\.\d+$/.test(normalized),
      ).toBe(true);
    },
  );
});
