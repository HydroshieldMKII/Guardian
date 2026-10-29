import { renderHook, waitFor } from "@testing-library/react";
import { usePasswordResetStatus } from "./usePasswordResetStatus";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
});

const respond = (ok: boolean, data: unknown = {}) =>
  fetchMock.mockResolvedValue({ ok, json: async () => data });

describe("usePasswordResetStatus", () => {
  it("reads what the server reports", async () => {
    respond(true, {
      enabled: true,
      appUrlConfigured: false,
      adminEmailConfigured: false,
    });
    const { result } = renderHook(() => usePasswordResetStatus());

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.appUrlConfigured).toBe(false);
    expect(result.current.anyAdminEmail).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pg/auth/password-reset/status",
    );
  });

  it("keeps resets off but requirements met when the server refuses", async () => {
    respond(false);
    const { result } = renderHook(() => usePasswordResetStatus());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toEqual({
      enabled: false,
      appUrlConfigured: true,
      anyAdminEmail: true,
    });
  });

  it("logs a failed request", async () => {
    const error = new Error("offline");
    fetchMock.mockRejectedValue(error);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    renderHook(() => usePasswordResetStatus());

    await waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        "Failed to check password reset status:",
        error,
      ),
    );
    log.mockRestore();
  });
});
