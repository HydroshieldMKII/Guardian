import {
  canAddNote,
  networkPolicyLabel,
  restrictedIPs,
  sentNote,
  streamLimitLabel,
} from "@/lib/portal";
import { portalDevice, portalRules } from "@/test-utils/portal";

describe("networkPolicyLabel", () => {
  it.each([
    ["both", "Local network and internet"],
    ["lan", "Local network only"],
    ["wan", "Internet only"],
    ["unknown", "Local network and internet"],
  ])("names the %s policy", (policy, label) => {
    expect(networkPolicyLabel(policy)).toBe(label);
  });
});

describe("streamLimitLabel", () => {
  it.each([
    [0, "Unlimited"],
    [1, "1 stream"],
    [3, "3 streams"],
  ])("labels a limit of %i", (limit, label) => {
    expect(streamLimitLabel(limit)).toBe(label);
  });
});

describe("restrictedIPs", () => {
  it("lists the allowed addresses of a restricted account", () => {
    expect(
      restrictedIPs(
        portalRules({ ipAccessPolicy: "restricted", allowedIPs: ["10.0.0.1"] }),
      ),
    ).toEqual(["10.0.0.1"]);
  });

  it("lists nothing when a restricted account has no addresses", () => {
    expect(
      restrictedIPs(portalRules({ ipAccessPolicy: "restricted" })),
    ).toEqual([]);
  });

  it("lists nothing when any address is allowed", () => {
    expect(restrictedIPs(portalRules({ allowedIPs: ["10.0.0.1"] }))).toEqual(
      [],
    );
  });
});

describe("canAddNote", () => {
  const settings = { showRules: false, allowRejectedRequests: false };

  it("lets a pending device get a note", () => {
    expect(canAddNote(portalDevice(), settings)).toBe(true);
  });

  it("allows a single note per device", () => {
    expect(
      canAddNote(
        portalDevice({ requestSubmittedAt: "2026-01-01T00:00:00Z" }),
        settings,
      ),
    ).toBe(false);
  });

  it("leaves approved devices alone", () => {
    expect(canAddNote(portalDevice({ status: "approved" }), settings)).toBe(
      false,
    );
  });

  it("lets a rejected device get a note only when the owner allows it", () => {
    const rejected = portalDevice({ status: "rejected" });
    expect(canAddNote(rejected, settings)).toBe(false);
    expect(canAddNote(rejected, null)).toBe(false);
    expect(
      canAddNote(rejected, { ...settings, allowRejectedRequests: true }),
    ).toBe(true);
  });
});

describe("sentNote", () => {
  const sent = {
    requestDescription: "My TV",
    requestSubmittedAt: "2026-01-01T00:00:00Z",
  };

  it.each(["pending", "rejected"] as const)(
    "shows the note sent for a %s device",
    (status) => {
      expect(sentNote(portalDevice({ ...sent, status }))).toEqual({
        description: "My TV",
        submittedAt: "2026-01-01T00:00:00Z",
        readAt: null,
      });
    },
  );

  it("carries when the owner read it", () => {
    expect(
      sentNote(portalDevice({ ...sent, requestNoteReadAt: "2026-01-02" })),
    ).toMatchObject({ readAt: "2026-01-02" });
  });

  it.each([
    ["an approved device", { ...sent, status: "approved" as const }],
    ["an empty note", { ...sent, requestDescription: "" }],
    ["an unsent note", { requestDescription: "My TV" }],
  ])("shows nothing for %s", (_label, overrides) => {
    expect(sentNote(portalDevice(overrides))).toBeNull();
  });
});
