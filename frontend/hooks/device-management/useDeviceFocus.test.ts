import { act, renderHook } from "@testing-library/react";
import { useDeviceFocus } from "@/hooks/device-management/useDeviceFocus";
import { HIGHLIGHT_CLASSES } from "@/lib/highlight";

const addDeviceElement = (deviceIdentifier: string) => {
  const element = document.createElement("div");
  element.dataset.deviceIdentifier = deviceIdentifier;
  element.scrollIntoView = jest.fn();
  document.body.appendChild(element);
  return element;
};

const setup = (selectedUserId: string | null = null) => {
  const selectUser = jest.fn<void, [string]>();
  const view = renderHook(
    ({ selected }) => useDeviceFocus(selected, selectUser),
    { initialProps: { selected: selectedUserId } },
  );
  return { ...view, selectUser };
};

beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => jest.useRealTimers());

describe("useDeviceFocus", () => {
  it("opens the owner, then scrolls to and flashes the device", () => {
    const element = addDeviceElement("device-1");
    const onDone = jest.fn();
    const { result, selectUser } = setup();

    act(() => result.current.focusDevice("u-1", "device-1", onDone));

    expect(selectUser).toHaveBeenCalledWith("u-1");
    expect(result.current.deviceFocus).toEqual({
      deviceIdentifier: "device-1",
    });

    act(() => jest.advanceTimersByTime(399));
    expect(element.scrollIntoView).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(element.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    act(() => jest.advanceTimersByTime(200));
    expect(element.classList).toContain(HIGHLIGHT_CLASSES[0]);
    expect(onDone).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1500));
    expect(element.classList).not.toContain(HIGHLIGHT_CLASSES[0]);
    expect(onDone).toHaveBeenCalled();
  });

  it("skips the selection and scrolls sooner when the owner is already open", () => {
    const element = addDeviceElement("device-1");
    const { result, selectUser } = setup("u-1");

    act(() => result.current.focusDevice("u-1", "device-1"));
    act(() => jest.advanceTimersByTime(100));

    expect(selectUser).not.toHaveBeenCalled();
    expect(element.scrollIntoView).toHaveBeenCalled();
  });

  it("follows the latest selection between renders", () => {
    addDeviceElement("device-1");
    const { result, rerender, selectUser } = setup();

    rerender({ selected: "u-1" });
    act(() => result.current.focusDevice("u-1", "device-1"));

    expect(selectUser).not.toHaveBeenCalled();
  });

  it("waits for the device to render before scrolling to it", () => {
    const { result } = setup("u-1");

    act(() => result.current.focusDevice("u-1", "device-1"));
    act(() => jest.advanceTimersByTime(100));
    const element = addDeviceElement("device-1");
    act(() => jest.advanceTimersByTime(100));

    expect(element.scrollIntoView).toHaveBeenCalled();
  });

  it("gives up after twenty lookups when the device never shows", () => {
    const onDone = jest.fn();
    const { result } = setup("u-1");

    act(() => result.current.focusDevice("u-1", "missing", onDone));
    act(() => jest.advanceTimersByTime(100 + 18 * 100));
    expect(onDone).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(100));
    expect(onDone).toHaveBeenCalled();
  });

  it("lets the caller clear the focus", () => {
    const { result } = setup("u-1");

    act(() => result.current.focusDevice("u-1", "device-1"));
    act(() => result.current.setDeviceFocus(null));

    expect(result.current.deviceFocus).toBeNull();
  });
});
