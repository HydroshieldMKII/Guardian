import { act, renderHook } from "@testing-library/react";
import {
  UnsavedChangesProvider,
  useUnsavedChanges,
} from "./unsaved-changes-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
);

const setup = () => renderHook(() => useUnsavedChanges(), { wrapper });

describe("useUnsavedChanges", () => {
  it("throws when used outside its provider", () => {
    const silence = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useUnsavedChanges())).toThrow(
      "useUnsavedChanges must be used within an UnsavedChangesProvider",
    );
    silence.mockRestore();
  });

  it("starts with nothing pending", () => {
    const { result } = setup();
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.pendingNavigation).toBeNull();
    expect(result.current.showUnsavedWarning).toBe(false);
    expect(result.current.onSaveAndLeave).toBeNull();
    expect(result.current.onDiscardChanges).toBeNull();
  });

  it("tracks the dirty flag", () => {
    const { result } = setup();

    act(() => result.current.setHasUnsavedChanges(true));
    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => result.current.setHasUnsavedChanges(false));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("tracks the pending navigation target", () => {
    const { result } = setup();

    act(() => result.current.setPendingNavigation("/settings"));
    expect(result.current.pendingNavigation).toBe("/settings");

    act(() => result.current.setPendingNavigation(null));
    expect(result.current.pendingNavigation).toBeNull();
  });

  it("tracks the warning visibility", () => {
    const { result } = setup();

    act(() => result.current.setShowUnsavedWarning(true));
    expect(result.current.showUnsavedWarning).toBe(true);
  });

  it("stores the save handler as a value rather than invoking it", () => {
    const { result } = setup();
    const handler = jest.fn().mockResolvedValue(undefined);

    act(() => result.current.setOnSaveAndLeave(handler));

    expect(result.current.onSaveAndLeave).toBe(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("stores the discard handler as a value rather than invoking it", () => {
    const { result } = setup();
    const handler = jest.fn();

    act(() => result.current.setOnDiscardChanges(handler));

    expect(result.current.onDiscardChanges).toBe(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the stored save handler on demand", async () => {
    const { result } = setup();
    const handler = jest.fn().mockResolvedValue(undefined);

    act(() => result.current.setOnSaveAndLeave(handler));
    await act(async () => {
      await result.current.onSaveAndLeave?.();
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("clears the stored handlers", () => {
    const { result } = setup();

    act(() => result.current.setOnSaveAndLeave(jest.fn()));
    act(() => result.current.setOnSaveAndLeave(null));
    expect(result.current.onSaveAndLeave).toBeNull();

    act(() => result.current.setOnDiscardChanges(jest.fn()));
    act(() => result.current.setOnDiscardChanges(null));
    expect(result.current.onDiscardChanges).toBeNull();
  });
});
