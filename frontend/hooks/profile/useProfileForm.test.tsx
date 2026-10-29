import { act, renderHook } from "@testing-library/react";
import { useProfileForm } from "@/hooks/profile/useProfileForm";

const updateProfile = jest.fn<Promise<void>, [Record<string, string>]>();
let user: { plexUserId: string } | null = null;
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user, updateProfile }),
  isAdminUser: () => false,
}));
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const submitEvent = { preventDefault: () => undefined };

beforeEach(() => {
  jest.clearAllMocks();
  updateProfile.mockResolvedValue(undefined);
});

describe("useProfileForm for someone who is not an admin", () => {
  it.each([null, { plexUserId: "p-1" }])(
    "shows a placeholder identity for %p and sends no changes",
    async (current) => {
      user = current;
      const onSaved = jest.fn();
      const { result } = renderHook(() => useProfileForm(true, onSaved));

      expect(result.current.displayName).toBe("User");
      expect(result.current.initials).toBe("?");
      expect(result.current.hasChanges).toBe(false);

      await act(() => result.current.submit(submitEvent));

      expect(updateProfile).toHaveBeenCalledWith({});
      expect(onSaved).toHaveBeenCalled();
    },
  );
});
