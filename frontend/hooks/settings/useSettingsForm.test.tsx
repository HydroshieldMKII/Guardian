import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api";
import { useSettingsForm } from "@/hooks/settings/useSettingsForm";
import { appSetting } from "@/test-utils/dashboard";
import type { AppSetting } from "@/types";

const updateConfig = jest.fn<Promise<void>, [unknown]>();
jest.mock("@/lib/api", () => ({
  ApiError:
    jest.requireActual<typeof import("@/lib/api")>("@/lib/api").ApiError,
  apiClient: {
    updateConfig: (changes: unknown) => updateConfig(changes),
  },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const updateSettings = jest.fn();
const STORED = [
  appSetting("PLEX_SERVER_IP", "10.0.0.2"),
  appSetting("PLEX_SERVER_PORT", "32400"),
];

const renderForm = (settings: AppSetting[] = STORED) =>
  renderHook(({ current }) => useSettingsForm(current, updateSettings), {
    initialProps: { current: settings },
  });

const editBoth = (result: ReturnType<typeof renderForm>["result"]) =>
  act(() =>
    result.current.change({
      PLEX_SERVER_IP: "10.0.0.3",
      PLEX_SERVER_PORT: "32401",
    }),
  );

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  updateConfig.mockResolvedValue(undefined);
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => consoleError.mockRestore());

describe("editing", () => {
  it("starts from the stored values with nothing to save", () => {
    const { result } = renderForm();

    expect(result.current.formData).toEqual({
      PLEX_SERVER_IP: "10.0.0.2",
      PLEX_SERVER_PORT: "32400",
    });
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("notices an edit and forgets it once reverted", () => {
    const { result } = renderForm();

    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));
    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.2" }));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("puts the stored values back on discard", () => {
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    act(() => result.current.discard());

    expect(result.current.formData.PLEX_SERVER_IP).toBe("10.0.0.2");
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("follows the stored values when they change", () => {
    const { result, rerender } = renderForm();

    rerender({ current: [appSetting("PLEX_SERVER_IP", "10.0.0.9")] });

    expect(result.current.formData).toEqual({ PLEX_SERVER_IP: "10.0.0.9" });
  });
});

describe("saving", () => {
  it("says there is nothing to save when nothing was edited", async () => {
    const { result } = renderForm();

    await act(() => result.current.save());

    expect(updateConfig).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({
      title: "No changes",
      description: "Nothing has been edited yet.",
    });
  });

  it("sends only the edited setting and stores it", async () => {
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    await act(() => result.current.save());

    expect(updateConfig).toHaveBeenCalledWith([
      { key: "PLEX_SERVER_IP", value: "10.0.0.3", type: "string" },
    ]);
    expect(updateSettings).toHaveBeenCalledWith([
      { key: "PLEX_SERVER_IP", value: "10.0.0.3" },
    ]);
    expect(toast).toHaveBeenCalledWith({
      title: "Settings saved",
      description: "1 setting updated.",
      variant: "success",
    });
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });

  it("counts several saved settings", async () => {
    const { result } = renderForm();
    editBoth(result);

    await act(() => result.current.save());

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "2 settings updated." }),
    );
  });

  it("marks the form as saving until the server answers", async () => {
    let answer: () => void = () => {};
    updateConfig.mockReturnValue(
      new Promise<void>((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.save();
    });
    await waitFor(() => expect(result.current.isSaving).toBe(true));

    await act(async () => {
      answer();
      await pending;
    });
    expect(result.current.isSaving).toBe(false);
  });

  it.each([
    [new Error("Server said no"), "Server said no"],
    ["boom", "Failed to save settings"],
  ])("reports a failed save (%p) and keeps the edits", async (error, text) => {
    updateConfig.mockRejectedValue(error);
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    await act(() => result.current.save());

    expect(consoleError).toHaveBeenCalledWith("Error saving settings:", error);
    expect(toast).toHaveBeenCalledWith({
      title: "Error",
      description: text,
      variant: "destructive",
    });
    expect(updateSettings).not.toHaveBeenCalled();
    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});

describe("saving before leaving", () => {
  it("does nothing when nothing was edited", async () => {
    const { result } = renderForm();

    await act(() => result.current.saveBeforeLeaving());

    expect(updateConfig).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("saves the edits", async () => {
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    await act(() => result.current.saveBeforeLeaving());

    expect(updateConfig).toHaveBeenCalled();
  });

  it("fails so the caller can stay on the page", async () => {
    updateConfig.mockRejectedValue(new Error("down"));
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    await act(() =>
      expect(result.current.saveBeforeLeaving()).rejects.toThrow("down"),
    );
  });
});

describe("rejected saves", () => {
  it("does not log an expected client error", async () => {
    updateConfig.mockRejectedValue(new ApiError(400, "Invalid port"));
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    await act(() => result.current.save());

    expect(consoleError).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Invalid port" }),
    );
  });

  it("still logs a server failure", async () => {
    const error = new ApiError(500, "Boom");
    updateConfig.mockRejectedValue(error);
    const { result } = renderForm();
    act(() => result.current.change({ PLEX_SERVER_IP: "10.0.0.3" }));

    await act(() => result.current.save());

    expect(consoleError).toHaveBeenCalledWith("Error saving settings:", error);
  });
});

describe("validation", () => {
  it("flags an out-of-range edit and refuses to save it", async () => {
    const { result } = renderForm();

    act(() => result.current.change({ PLEX_SERVER_PORT: "99999999" }));

    expect(result.current.hasErrors).toBe(true);
    await act(async () => {
      await result.current.saveBeforeLeaving().catch(() => undefined);
      await result.current.save();
    });
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it("clears the flag once the value is valid", () => {
    const { result } = renderForm();

    act(() => result.current.change({ PLEX_SERVER_PORT: "0" }));
    expect(result.current.hasErrors).toBe(true);

    act(() => result.current.change({ PLEX_SERVER_PORT: "32401" }));
    expect(result.current.hasErrors).toBe(false);
  });
});
