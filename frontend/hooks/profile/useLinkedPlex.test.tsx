import { renderHook, waitFor } from "@testing-library/react";
import { useLinkedPlex } from "@/hooks/profile/useLinkedPlex";

type TestUser = { plexUserId: string; plexUsername?: string } | null;
let user: TestUser = null;
let admin = false;
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user,
    linkPlexAccount: jest.fn(),
    unlinkPlexAccount: jest.fn(),
  }),
  isAdminUser: () => admin,
}));
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("@/hooks/use-plex-oauth", () => ({
  usePlexOAuth: () => ({
    loading: false,
    waiting: false,
    start: jest.fn(),
    cancel: jest.fn(),
  }),
}));

beforeEach(() => {
  admin = false;
});

describe("useLinkedPlex for someone who is not an admin", () => {
  it.each([null, { plexUserId: "p-1" }])(
    "shows no linked account for %p",
    (current) => {
      user = current;
      const fetchSpy = jest.spyOn(global, "fetch");

      const { result } = renderHook(() => useLinkedPlex(true));

      expect(result.current.account).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    },
  );
});

describe("useLinkedPlex for an admin", () => {
  it("falls back to the signed-in account when the fresh lookup fails", async () => {
    admin = true;
    user = { plexUserId: "p-1", plexUsername: "plexname" };
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useLinkedPlex(true));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(result.current.account).toEqual({
      plexUserId: "p-1",
      plexUsername: "plexname",
      plexThumb: undefined,
    });
    fetchSpy.mockRestore();
  });
});
