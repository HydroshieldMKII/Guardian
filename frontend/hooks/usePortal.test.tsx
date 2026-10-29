import { act, waitFor } from "@testing-library/react";
import { usePortalData, useSendPortalNote } from "@/hooks/usePortal";
import { portalDevice, portalRules } from "@/test-utils/portal";
import { renderHookWithQuery } from "@/test-utils/query";
import type { PortalDevice, PortalSettings, PortalUserRules } from "@/types";

const api = {
  devices: jest.fn<Promise<PortalDevice[]>, []>(),
  settings: jest.fn<Promise<PortalSettings>, []>(),
  rules: jest.fn<Promise<PortalUserRules | null>, []>(),
  sendNote: jest.fn<Promise<void>, [number, string]>(),
};
jest.mock("@/lib/portal-api", () => ({
  portalApi: {
    devices: () => api.devices(),
    settings: () => api.settings(),
    rules: () => api.rules(),
    sendNote: (deviceId: number, description: string) =>
      api.sendNote(deviceId, description),
  },
}));

const toast = jest.fn<void, [unknown]>();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const settings = (showRules: boolean): PortalSettings => ({
  showRules,
  allowRejectedRequests: false,
});

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  api.devices.mockResolvedValue([portalDevice()]);
  api.settings.mockResolvedValue(settings(false));
  api.rules.mockResolvedValue(portalRules());
  api.sendNote.mockResolvedValue(undefined);
});

afterEach(() => consoleError.mockRestore());

const loaded = async (enabled = true) => {
  const view = renderHookWithQuery(() => usePortalData(enabled));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
};

describe("usePortalData", () => {
  it("waits while signed out", () => {
    const { result } = renderHookWithQuery(() => usePortalData(false));

    expect(result.current.loading).toBe(true);
    expect(result.current.devices).toEqual([]);
    expect(api.devices).not.toHaveBeenCalled();
  });

  it("loads the devices and the settings", async () => {
    const { result } = await loaded();

    expect(result.current.devices).toEqual([portalDevice()]);
    expect(result.current.settings).toEqual(settings(false));
    expect(result.current.userRules).toBeNull();
    expect(api.rules).not.toHaveBeenCalled();
  });

  it("loads the rules too when the owner shares them", async () => {
    api.settings.mockResolvedValue(settings(true));

    const { result } = await loaded();

    expect(result.current.userRules).toEqual(portalRules());
  });

  it("keeps loading until the shared rules arrive", async () => {
    api.settings.mockResolvedValue(settings(true));
    api.rules.mockReturnValue(new Promise(() => {}));

    const { result } = renderHookWithQuery(() => usePortalData(true));

    await waitFor(() => expect(api.rules).toHaveBeenCalled());
    expect(result.current.loading).toBe(true);
  });

  it("says when something failed to load and shows what did", async () => {
    api.devices.mockRejectedValue(new Error("offline"));

    const { result } = await loaded();

    expect(result.current.devices).toEqual([]);
    expect(result.current.settings).toEqual(settings(false));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Failed to load your data" }),
    );
  });

  it("says so again when a refresh fails too", async () => {
    api.devices.mockRejectedValue(new Error("offline"));
    const { result } = await loaded();

    await act(() => result.current.refresh());

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
  });

  it("refreshes everything it shows", async () => {
    api.settings.mockResolvedValue(settings(true));
    const { result } = await loaded();
    api.devices.mockResolvedValue([]);

    let refreshing: Promise<void> = Promise.resolve();
    act(() => {
      refreshing = result.current.refresh();
    });
    expect(result.current.refreshing).toBe(true);
    await act(() => refreshing);

    expect(result.current.refreshing).toBe(false);
    expect(result.current.devices).toEqual([]);
    expect(api.devices).toHaveBeenCalledTimes(2);
    expect(api.settings).toHaveBeenCalledTimes(2);
    expect(api.rules).toHaveBeenCalledTimes(2);
  });
});

describe("useSendPortalNote", () => {
  it("sends the note and reloads the devices", async () => {
    const { result } = renderHookWithQuery(() => ({
      portal: usePortalData(true),
      send: useSendPortalNote(),
    }));
    await waitFor(() => expect(result.current.portal.loading).toBe(false));

    await act(() =>
      result.current.send.mutateAsync({ deviceId: 1, description: "Hi" }),
    );

    expect(api.sendNote).toHaveBeenCalledWith(1, "Hi");
    await waitFor(() => expect(api.devices).toHaveBeenCalledTimes(2));
  });
});
