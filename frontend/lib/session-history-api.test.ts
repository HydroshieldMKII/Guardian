import { sessionHistoryApi } from "@/lib/session-history-api";

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

const defaults = { search: "", terminatedOnly: false, app: "all" } as const;

describe("sessionHistoryApi.page", () => {
  it("asks for one page including running sessions", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 1 }] });

    await expect(
      sessionHistoryApi.page("u-1", defaults, 25, 25),
    ).resolves.toEqual([{ id: 1 }]);
    expect(lastUrl()).toMatch(/\/sessions\/history\/u-1\?/);
    expect(lastUrl()).toContain("limit=25&offset=25&includeActive=true");
    expect(lastUrl()).not.toMatch(/search|terminatedOnly|app=/);
  });

  it("passes every filter that is set", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    await sessionHistoryApi.page(
      "u-1",
      { search: "arrival", terminatedOnly: true, app: "plex" },
      0,
      25,
    );

    expect(lastUrl()).toContain("search=arrival");
    expect(lastUrl()).toContain("terminatedOnly=true");
    expect(lastUrl()).toContain("app=plex");
  });

  it("treats a payload that is not a list as empty", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => null });

    await expect(
      sessionHistoryApi.page("u-1", defaults, 0, 25),
    ).resolves.toEqual([]);
  });

  it("throws on a refused request", async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(
      sessionHistoryApi.page("u-1", defaults, 0, 25),
    ).rejects.toThrow("Failed to fetch user history");
  });
});

describe("sessionHistoryApi.remove", () => {
  it("deletes one entry and reports whether it worked", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(sessionHistoryApi.remove(7)).resolves.toBe(true);
    expect(lastUrl()).toMatch(/\/sessions\/history\/7$/);
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: "DELETE" });

    fetchMock.mockResolvedValue({ ok: false });
    await expect(sessionHistoryApi.remove(7)).resolves.toBe(false);
  });
});
