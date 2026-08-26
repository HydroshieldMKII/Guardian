import { renderHook } from "@testing-library/react";
import { useUserPreferences } from "./useUserPreferences";

const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();

const lastRequest = () => {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was never called");
  const [input, init] = call;
  return { url: String(input), init: init ?? {} };
};

const prefs = () => renderHook(() => useUserPreferences()).result.current;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  globalThis.fetch = fetchMock;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("updateUserPreference", () => {
  it("posts the default-block flag to the user endpoint", async () => {
    await prefs().updateUserPreference("42", true);

    expect(lastRequest().url).toBe("/api/pg/users/42/preference");
    expect(lastRequest().init.method).toBe("POST");
    expect(lastRequest().init.body).toBe(JSON.stringify({ defaultBlock: true }));
  });

  it("supports clearing the override with null", async () => {
    await prefs().updateUserPreference("42", null);
    expect(lastRequest().init.body).toBe(
      JSON.stringify({ defaultBlock: null }),
    );
  });

  it("url-encodes the user id", async () => {
    await prefs().updateUserPreference("a b/c", true);
    expect(lastRequest().url).toBe("/api/pg/users/a%20b%2Fc/preference");
  });

  it("reports success for an ok response", async () => {
    await expect(prefs().updateUserPreference("42", true)).resolves.toBe(true);
  });

  it("reports failure for an error response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(prefs().updateUserPreference("42", true)).resolves.toBe(false);
  });

  it("reports failure when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(prefs().updateUserPreference("42", true)).resolves.toBe(false);
  });
});

describe("updateUserIPPolicy", () => {
  it("posts the supplied policy updates", async () => {
    await prefs().updateUserIPPolicy("42", { networkPolicy: "lan" });

    expect(lastRequest().url).toBe("/api/pg/users/42/ip-policy");
    expect(lastRequest().init.method).toBe("POST");
    expect(lastRequest().init.body).toBe(
      JSON.stringify({ networkPolicy: "lan" }),
    );
  });

  it("reports success for an ok response", async () => {
    await expect(
      prefs().updateUserIPPolicy("42", { ipAccessPolicy: "restricted" }),
    ).resolves.toBe(true);
  });

  it("reports failure for an error response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));
    await expect(prefs().updateUserIPPolicy("42", {})).resolves.toBe(false);
  });

  it("reports failure when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(prefs().updateUserIPPolicy("42", {})).resolves.toBe(false);
  });
});
