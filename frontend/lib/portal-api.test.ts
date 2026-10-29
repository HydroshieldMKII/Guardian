import { portalApi } from "@/lib/portal-api";
import { portalDevice, portalRules } from "@/test-utils/portal";

const fetchMock = jest.fn<
  Promise<Partial<Response>>,
  Parameters<typeof fetch>
>();

const answer = (body: unknown, ok = true) =>
  fetchMock.mockResolvedValue({ ok, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = (...args: Parameters<typeof fetch>) =>
    fetchMock(...args) as Promise<Response>;
});

describe("portalApi reads", () => {
  it.each([
    ["devices", () => portalApi.devices(), [portalDevice()]],
    [
      "settings",
      () => portalApi.settings(),
      { showRules: true, allowRejectedRequests: false },
    ],
  ] as const)(
    "loads the %s with the session cookie",
    async (path, load, body) => {
      answer(body);

      await expect(load()).resolves.toEqual(body);
      expect(fetchMock).toHaveBeenCalledWith(`/api/pg/user-portal/${path}`, {
        credentials: "include",
      });
    },
  );

  it("fails on a refused request", async () => {
    answer({}, false);

    await expect(portalApi.devices()).rejects.toThrow(
      "Failed to load the portal devices",
    );
  });

  it("hands back the rules when the owner shares them", async () => {
    answer({ enabled: true, rules: portalRules() });

    await expect(portalApi.rules()).resolves.toEqual(portalRules());
  });

  it.each([
    ["turned off", { enabled: false, rules: null }],
    ["missing", { enabled: true, rules: null }],
  ])("hands back no rules when they are %s", async (_label, body) => {
    answer(body);

    await expect(portalApi.rules()).resolves.toBeNull();
  });
});

describe("portalApi.sendNote", () => {
  it("posts the note for the device", async () => {
    answer({ success: true });

    await portalApi.sendNote(7, "Kitchen tablet");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pg/user-portal/devices/7/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: "Kitchen tablet" }),
      },
    );
  });

  it("passes the server's reason on", async () => {
    answer({ message: "Note already submitted" }, false);

    await expect(portalApi.sendNote(7, "")).rejects.toThrow(
      "Note already submitted",
    );
  });

  it.each([
    ["has no reason", async () => ({})],
    [
      "is not JSON",
      async () => {
        throw new SyntaxError("Unexpected token");
      },
    ],
  ])("falls back to a generic reason when the answer %s", async (_l, json) => {
    fetchMock.mockResolvedValue({ ok: false, json });

    await expect(portalApi.sendNote(7, "")).rejects.toThrow(
      "Failed to submit request",
    );
  });
});
