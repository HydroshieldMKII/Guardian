import { act, renderHook } from "@testing-library/react";
import { UserDevice } from "@/types";
import { useDeviceActions } from "./useDeviceActions";

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

const ok = (body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1];

const bodyOf = () => JSON.parse(lastCall()[1]?.body as string);

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;
  fetchMock.mockImplementation(async () => ok());
});

describe("useDeviceActions", () => {
  it("starts with no action in flight", () => {
    const { result } = renderHook(() => useDeviceActions());
    expect(result.current.actionLoading).toBeNull();
  });

  describe.each([
    ["approveDevice", "approve"],
    ["rejectDevice", "reject"],
    ["setPendingDevice", "set-pending"],
    ["deleteDevice", "delete"],
    ["revokeTemporaryAccess", "revoke-temporary-access"],
  ] as const)("%s", (method, path) => {
    it(`posts to the ${path} endpoint`, async () => {
      const { result } = renderHook(() => useDeviceActions());

      let succeeded: boolean | undefined;
      await act(async () => {
        succeeded = await result.current[method](5);
      });

      expect(succeeded).toBe(true);
      expect(lastCall()[0]).toBe(`/api/pg/devices/5/${path}`);
      expect(lastCall()[1]?.method).toBe("POST");
    });

    it("reports a server rejection as a failure", async () => {
      fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
      const { result } = renderHook(() => useDeviceActions());

      let succeeded: boolean | undefined;
      await act(async () => {
        succeeded = await result.current[method](5);
      });

      expect(succeeded).toBe(false);
    });

    it("reports a network failure without throwing", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      const { result } = renderHook(() => useDeviceActions());

      let succeeded: boolean | undefined;
      await act(async () => {
        succeeded = await result.current[method](5);
      });

      expect(succeeded).toBe(false);
    });

    it("clears the in-flight marker when it finishes", async () => {
      const { result } = renderHook(() => useDeviceActions());

      await act(async () => {
        await result.current[method](5);
      });

      expect(result.current.actionLoading).toBeNull();
    });
  });

  describe("renameDevice", () => {
    it("sends the new name as JSON", async () => {
      const { result } = renderHook(() => useDeviceActions());

      await act(async () => {
        await result.current.renameDevice(5, "Attic TV");
      });

      expect(lastCall()[0]).toBe("/api/pg/devices/5/rename");
      expect(bodyOf()).toEqual({ newName: "Attic TV" });
    });

    it("reports a network failure", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      const { result } = renderHook(() => useDeviceActions());

      let succeeded: boolean | undefined;
      await act(async () => {
        succeeded = await result.current.renameDevice(5, "Attic TV");
      });

      expect(succeeded).toBe(false);
    });
  });

  describe("grantTemporaryAccess", () => {
    it("sends the duration and bypass flag", async () => {
      const { result } = renderHook(() => useDeviceActions());

      await act(async () => {
        await result.current.grantTemporaryAccess(5, 30, true);
      });

      expect(lastCall()[0]).toBe("/api/pg/devices/5/temporary-access");
      expect(bodyOf()).toEqual({ durationMinutes: 30, bypassPolicies: true });
    });

    it("omits an unspecified bypass flag", async () => {
      const { result } = renderHook(() => useDeviceActions());

      await act(async () => {
        await result.current.grantTemporaryAccess(5, 30);
      });

      expect(bodyOf()).toEqual({ durationMinutes: 30 });
    });

    it("reports a network failure", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      const { result } = renderHook(() => useDeviceActions());

      let succeeded: boolean | undefined;
      await act(async () => {
        succeeded = await result.current.grantTemporaryAccess(5, 30);
      });

      expect(succeeded).toBe(false);
    });
  });

  describe("grantBatchTemporaryAccess", () => {
    it("sends every device id in one request", async () => {
      fetchMock.mockImplementation(async () =>
        ok({ results: [{ deviceId: 1, success: true }] }),
      );
      const { result } = renderHook(() => useDeviceActions());

      let outcome: { success: boolean; results?: unknown } | undefined;
      await act(async () => {
        outcome = await result.current.grantBatchTemporaryAccess(
          [1, 2],
          30,
          false,
        );
      });

      expect(lastCall()[0]).toBe("/api/pg/devices/batch/temporary-access");
      expect(bodyOf()).toEqual({
        deviceIds: [1, 2],
        durationMinutes: 30,
        bypassPolicies: false,
      });
      expect(outcome).toEqual({
        success: true,
        results: [{ deviceId: 1, success: true }],
      });
    });

    it("reports a server rejection as a failure with no results", async () => {
      fetchMock.mockImplementation(
        async () => new Response("bad request", { status: 400 }),
      );
      const { result } = renderHook(() => useDeviceActions());

      let outcome: { success: boolean; results?: unknown } | undefined;
      await act(async () => {
        outcome = await result.current.grantBatchTemporaryAccess([1], 30);
      });

      expect(outcome).toEqual({ success: false });
    });

    it("reports a network failure", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      const { result } = renderHook(() => useDeviceActions());

      let outcome: { success: boolean } | undefined;
      await act(async () => {
        outcome = await result.current.grantBatchTemporaryAccess([1], 30);
      });

      expect(outcome).toEqual({ success: false });
    });
  });

  describe("toggleApproval", () => {
    const device = (status: UserDevice["status"]): UserDevice =>
      ({ id: 5, status }) as UserDevice;

    it("rejects a device that is currently approved", async () => {
      const { result } = renderHook(() => useDeviceActions());

      await act(async () => {
        await result.current.toggleApproval(device("approved"));
      });

      expect(lastCall()[0]).toBe("/api/pg/devices/5/reject");
    });

    it.each(["pending", "rejected"] as const)(
      "approves a device that is currently %s",
      async (status) => {
        const { result } = renderHook(() => useDeviceActions());

        await act(async () => {
          await result.current.toggleApproval(device(status));
        });

        expect(lastCall()[0]).toBe("/api/pg/devices/5/approve");
      },
    );
  });
});
