import { act, renderHook } from "@testing-library/react";
import { useSettingsTab } from "@/hooks/settings/useSettingsTab";

const setHash = (hash: string) => {
  window.history.replaceState(null, "", hash ? `#${hash}` : " ");
};

beforeEach(() => setHash(""));

describe("useSettingsTab", () => {
  it("opens the Plex tab by default and writes it to the URL", () => {
    const { result } = renderHook(() => useSettingsTab());

    expect(result.current.activeTab).toBe("plex");
    expect(window.location.hash).toBe("#plex");
  });

  it("opens the tab named in the URL", () => {
    setHash("smtp");

    const { result } = renderHook(() => useSettingsTab());

    expect(result.current.activeTab).toBe("smtp");
  });

  it("ignores an unknown tab in the URL", () => {
    setHash("billing");

    const { result } = renderHook(() => useSettingsTab());

    expect(result.current.activeTab).toBe("plex");
  });

  it("selects a known tab and keeps the URL in step", () => {
    const { result } = renderHook(() => useSettingsTab());

    act(() => result.current.selectTab("admin"));

    expect(result.current.activeTab).toBe("admin");
    expect(window.location.hash).toBe("#admin");
  });

  it("ignores an unknown tab selection", () => {
    const { result } = renderHook(() => useSettingsTab());

    act(() => result.current.selectTab("billing"));

    expect(result.current.activeTab).toBe("plex");
  });

  it.each([
    ["system", "system"],
    ["billing", "plex"],
  ])("follows back and forward navigation to #%s", (hash, expected) => {
    const { result } = renderHook(() => useSettingsTab());

    act(() => {
      setHash(hash);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(result.current.activeTab).toBe(expected);
  });

  it("stops listening once unmounted", () => {
    const remove = jest.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useSettingsTab());

    unmount();

    expect(remove).toHaveBeenCalledWith("hashchange", expect.any(Function));
    remove.mockRestore();
  });
});
