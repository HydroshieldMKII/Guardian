import { versionApi } from "@/lib/version-api";

const fetchMock = jest.fn<
  Promise<Partial<Response>>,
  Parameters<typeof fetch>
>();
const lastUrl = () => {
  const url = fetchMock.mock.calls.at(-1)?.[0];
  return typeof url === "string" ? url : "";
};

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = (...args: Parameters<typeof fetch>) =>
    fetchMock(...args) as Promise<Response>;
});

describe("versionApi.info", () => {
  it("loads the installed version", async () => {
    const info = { version: "1.3.5", isVersionMismatch: false };
    fetchMock.mockResolvedValue({ ok: true, json: async () => info });

    await expect(versionApi.info()).resolves.toEqual(info);
    expect(lastUrl()).toMatch(/\/config\/version$/);
  });

  it("throws with the status on a refused request", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(versionApi.info()).rejects.toThrow(
      "Failed to fetch version info: 500",
    );
  });
});

describe("versionApi.latestRelease", () => {
  it("reads the latest release from GitHub", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: "v2.0.0",
        html_url: "https://example.test/v2.0.0",
        body: "Fixes",
      }),
    });

    await expect(versionApi.latestRelease()).resolves.toEqual({
      version: "2.0.0",
      url: "https://example.test/v2.0.0",
      notes: "Fixes",
    });
    expect(lastUrl()).toBe(
      "https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest",
    );
  });

  it.each([null, undefined])(
    "keeps a tag without a v prefix and turns %p notes into an empty string",
    async (body) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "2.0.0", html_url: "u", body }),
      });

      await expect(versionApi.latestRelease()).resolves.toEqual({
        version: "2.0.0",
        url: "u",
        notes: "",
      });
    },
  );

  it("throws with the status when GitHub refuses", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    await expect(versionApi.latestRelease()).rejects.toThrow(
      "Failed to check for updates: 403",
    );
  });
});
