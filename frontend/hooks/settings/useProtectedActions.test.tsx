import { act, renderHook } from "@testing-library/react";
import { useProtectedActions } from "@/hooks/settings/useProtectedActions";

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

describe("useProtectedActions", () => {
  it("runs nothing when no action is waiting for a password", async () => {
    const { result } = renderHook(() => useProtectedActions());

    await act(() => result.current.run("secret"));

    expect(result.current.busy).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
});
