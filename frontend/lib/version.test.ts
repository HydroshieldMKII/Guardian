import { isVersionNewer, updateInfoFor } from "@/lib/version";

describe("isVersionNewer", () => {
  it.each([
    ["1.4.0", true],
    ["1.3.6", true],
    ["2.0.0", true],
    ["1.3.5", false],
    ["1.3.4", false],
    ["1.2.9", false],
    ["1.3", false],
    ["1.3.5.1", true],
    ["1.3.5-rc.1", false],
    ["1.3.6-rc.1", true],
    ["1.3.x", false],
    ["1.3.beta", false],
  ])("treats %s against 1.3.5 as newer=%p", (candidate, expected) => {
    expect(isVersionNewer(candidate, "1.3.5")).toBe(expected);
  });

  it.each([
    ["1.4.0", true],
    ["1.4.0-rc.10", true],
    ["1.4.0-rc.2", false],
    ["1.3.9", false],
  ])("treats %s against 1.4.0-rc.2 as newer=%p", (candidate, expected) => {
    expect(isVersionNewer(candidate, "1.4.0-rc.2")).toBe(expected);
  });
});

describe("updateInfoFor", () => {
  it("describes a release against the installed version", () => {
    expect(
      updateInfoFor(
        { version: "2.0.0", url: "https://example.test", notes: "Fixes" },
        "1.3.5",
      ),
    ).toEqual({
      hasUpdate: true,
      latestVersion: "2.0.0",
      currentVersion: "1.3.5",
      updateUrl: "https://example.test",
      releaseNotes: "Fixes",
    });
  });
});
