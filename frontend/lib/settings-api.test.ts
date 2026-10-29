import { settingsApi } from "@/lib/settings-api";
import { appSetting } from "@/test-utils/dashboard";

const fetchMock = jest.fn<
  Promise<Partial<Response>>,
  Parameters<typeof fetch>
>();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = (...args: Parameters<typeof fetch>) =>
    fetchMock(...args) as Promise<Response>;
});

describe("settingsApi.list", () => {
  it("loads every setting", async () => {
    const settings = [appSetting("TIMEZONE", "+00:00")];
    fetchMock.mockResolvedValue({ ok: true, json: async () => settings });

    await expect(settingsApi.list()).resolves.toEqual(settings);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/config$/);
  });

  it("throws on a refused request", async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(settingsApi.list()).rejects.toThrow(
      "Failed to fetch configuration",
    );
  });
});
