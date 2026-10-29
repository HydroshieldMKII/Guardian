import { renderHook } from "@testing-library/react";
import { useRegisterUnsavedChanges } from "@/hooks/settings/useRegisterUnsavedChanges";

const setHasUnsavedChanges = jest.fn<void, [boolean]>();
const setSaveBlocked = jest.fn<void, [boolean]>();
const setOnSaveAndLeave = jest.fn<void, [(() => Promise<void>) | null]>();
const setOnDiscardChanges = jest.fn<void, [(() => void) | null]>();
jest.mock("@/contexts/unsaved-changes-context", () => ({
  useUnsavedChanges: () => ({
    setHasUnsavedChanges,
    setSaveBlocked,
    setOnSaveAndLeave,
    setOnDiscardChanges,
  }),
}));

const save = () => Promise.resolve();
const discard = () => {};

beforeEach(() => jest.clearAllMocks());

describe("useRegisterUnsavedChanges", () => {
  it("shares the unsaved state and the save and discard handlers", () => {
    const { rerender } = renderHook(
      ({ dirty }) => useRegisterUnsavedChanges(dirty, save, discard),
      { initialProps: { dirty: false } },
    );

    rerender({ dirty: true });

    expect(setHasUnsavedChanges).toHaveBeenLastCalledWith(true);
    expect(setOnSaveAndLeave).toHaveBeenCalledWith(save);
    expect(setOnDiscardChanges).toHaveBeenCalledWith(discard);
  });

  it("keeps the unsaved state when the handlers change during an edit", () => {
    const { rerender } = renderHook(
      ({ handler }) => useRegisterUnsavedChanges(true, handler, discard),
      { initialProps: { handler: save } },
    );

    rerender({ handler: () => Promise.resolve() });

    expect(setHasUnsavedChanges).toHaveBeenLastCalledWith(true);
  });

  it("shares whether saving is currently blocked", () => {
    const { rerender } = renderHook(
      ({ blocked }) => useRegisterUnsavedChanges(true, save, discard, blocked),
      { initialProps: { blocked: false } },
    );
    expect(setSaveBlocked).toHaveBeenLastCalledWith(false);

    rerender({ blocked: true });

    expect(setSaveBlocked).toHaveBeenLastCalledWith(true);
  });

  it("clears everything once unmounted", () => {
    const { unmount } = renderHook(() =>
      useRegisterUnsavedChanges(true, save, discard),
    );

    unmount();

    expect(setHasUnsavedChanges).toHaveBeenLastCalledWith(false);
    expect(setSaveBlocked).toHaveBeenLastCalledWith(false);
    expect(setOnSaveAndLeave).toHaveBeenLastCalledWith(null);
    expect(setOnDiscardChanges).toHaveBeenLastCalledWith(null);
  });
});
