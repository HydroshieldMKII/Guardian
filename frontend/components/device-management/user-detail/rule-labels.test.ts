import type { UserPreference } from "@/types";
import {
  countLabel,
  networkLabel,
  streamLimitDescription,
  streamLimitLabel,
} from "./rule-labels";

const preference = (changes: Partial<UserPreference>): UserPreference => ({
  id: 1,
  userId: "user-1",
  defaultBlock: null,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  allowedIPs: [],
  hidden: false,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...changes,
});

describe("rule labels", () => {
  it("labels the stream limit", () => {
    expect(streamLimitLabel(undefined)).toBe("Global default");
    expect(streamLimitLabel(null)).toBe("Global default");
    expect(streamLimitLabel(0)).toBe("Unlimited");
    expect(streamLimitLabel(3)).toBe("3");
  });

  it("mentions devices left out of the stream limit", () => {
    expect(streamLimitDescription(0)).toBe(
      "How many streams this user can run at the same time",
    );
    expect(streamLimitDescription(1)).toMatch(/1 device is not counted\.$/);
    expect(streamLimitDescription(2)).toMatch(/2 devices are not counted\.$/);
  });

  it("labels the network rule", () => {
    expect(networkLabel(undefined)).toBe("Anywhere");
    expect(networkLabel(preference({}))).toBe("Anywhere");
    expect(networkLabel(preference({ networkPolicy: "lan" }))).toBe(
      "Local network only",
    );
    expect(
      networkLabel(
        preference({
          networkPolicy: "wan",
          ipAccessPolicy: "restricted",
          allowedIPs: ["10.0.0.1"],
        }),
      ),
    ).toBe("Internet only, listed addresses");
  });

  it("counts or says none", () => {
    expect(countLabel(0, "rule")).toBe("None");
    expect(countLabel(2, "rule")).toBe("2 rules");
  });
});
