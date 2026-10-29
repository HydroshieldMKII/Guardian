import { act, renderHook } from "@testing-library/react";
import { useUserPolicyUpdates } from "@/hooks/device-management/useUserPolicyUpdates";

const updateUserPreference = jest.fn<Promise<boolean>, unknown[]>();
const updateUserIPPolicy = jest.fn<Promise<boolean>, unknown[]>();
jest.mock("@/hooks/device-management/useUserPreferences", () => ({
  useUserPreferences: () => ({ updateUserPreference, updateUserIPPolicy }),
}));

const toast = jest.fn<void, [unknown]>();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const lastToast = () => toast.mock.calls.at(-1)?.[0];

const setup = () => {
  const refresh = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  const { result } = renderHook(() => useUserPolicyUpdates(refresh));
  return { result, refresh };
};

beforeEach(() => {
  jest.clearAllMocks();
  updateUserPreference.mockResolvedValue(true);
  updateUserIPPolicy.mockResolvedValue(true);
});

describe("useUserPolicyUpdates", () => {
  it("marks the user as updating until the default policy is saved", async () => {
    let finish: (saved: boolean) => void = () => {};
    updateUserPreference.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, refresh } = setup();

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.updateDefaultPolicy("u-1", true);
    });
    expect(result.current.updatingUserId).toBe("u-1");

    await act(async () => {
      finish(true);
      await pending;
    });

    expect(updateUserPreference).toHaveBeenCalledWith("u-1", true);
    expect(refresh).toHaveBeenCalled();
    expect(result.current.updatingUserId).toBeNull();
    expect(lastToast()).toMatchObject({
      title: "Default device policy updated",
    });
  });

  it.each([
    ["is refused", () => updateUserPreference.mockResolvedValue(false)],
    [
      "throws",
      () => updateUserPreference.mockRejectedValue(new Error("offline")),
    ],
  ])("reports a default policy update that %s", async (_, arrange) => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    arrange();
    const { result, refresh } = setup();

    await act(() => result.current.updateDefaultPolicy("u-1", null));

    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.updatingUserId).toBeNull();
    expect(lastToast()).toMatchObject({
      title: "Update failed",
      description: "Failed to update the New devices rule",
    });
    consoleError.mockRestore();
  });

  it("refreshes after an IP policy change", async () => {
    const { result, refresh } = setup();

    await act(() =>
      result.current.updateIPPolicy("u-1", { networkPolicy: "lan" }),
    );

    expect(updateUserIPPolicy).toHaveBeenCalledWith("u-1", {
      networkPolicy: "lan",
    });
    expect(refresh).toHaveBeenCalled();
    expect(lastToast()).toMatchObject({ title: "IP access updated" });
  });

  it("reports a refused IP policy change", async () => {
    updateUserIPPolicy.mockResolvedValue(false);
    const { result, refresh } = setup();

    await act(() =>
      result.current.updateIPPolicy("u-1", { networkPolicy: "lan" }),
    );

    expect(refresh).not.toHaveBeenCalled();
    expect(lastToast()).toMatchObject({
      description: "Failed to update the IP access policies",
    });
  });
});
