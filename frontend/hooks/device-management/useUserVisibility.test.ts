import { act, waitFor } from "@testing-library/react";
import { renderHookWithQuery } from "@/test-utils/query";
import { useUserVisibility } from "@/hooks/device-management/useUserVisibility";
import { apiClient } from "@/lib/api";
import type { UserPreference } from "@/types";

jest.mock("@/lib/api", () => ({
  apiClient: {
    getHiddenUsers: jest.fn(),
    toggleUserVisibility: jest.fn(),
  },
}));

const toast = jest.fn<void, [unknown]>();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const api = jest.mocked(apiClient);
const lastToast = () => toast.mock.calls.at(-1)?.[0];

const preference = (
  overrides: Partial<UserPreference> = {},
): UserPreference => ({
  id: 1,
  userId: "u-1",
  username: "alex",
  defaultBlock: null,
  hidden: false,
  networkPolicy: "both",
  ipAccessPolicy: "all",
  allowedIPs: [],
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const setup = (users: UserPreference[] = [preference()]) => {
  const refresh = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  const onHidden = jest.fn();
  const view = renderHookWithQuery(() =>
    useUserVisibility({ users, refresh, onHidden }),
  );
  return { ...view, refresh, onHidden };
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  api.getHiddenUsers.mockResolvedValue([]);
  api.toggleUserVisibility.mockResolvedValue({});
});

afterEach(() => consoleError.mockRestore());

describe("useUserVisibility", () => {
  it("loads hidden users only once the list is opened", async () => {
    api.getHiddenUsers.mockResolvedValue([preference({ hidden: true })]);
    const { result } = setup();

    expect(api.getHiddenUsers).not.toHaveBeenCalled();
    act(() => result.current.setHiddenUsersOpen(true));

    await waitFor(() => expect(result.current.hiddenUsers).toHaveLength(1));
    expect(result.current.loadingHiddenUsers).toBe(false);
  });

  it("asks before hiding a visible user", async () => {
    const { result } = setup();

    await act(() => result.current.toggleVisibility("u-1"));

    expect(result.current.hideCandidate).toEqual({
      userId: "u-1",
      username: "alex",
    });
    expect(api.toggleUserVisibility).not.toHaveBeenCalled();
  });

  it("falls back to the user id for an unknown user", async () => {
    const { result } = setup([]);

    await act(() => result.current.toggleVisibility("u-9"));

    expect(result.current.hideCandidate).toEqual({
      userId: "u-9",
      username: "u-9",
    });
  });

  it("can back out of hiding a user", async () => {
    const { result } = setup();

    await act(() => result.current.toggleVisibility("u-1"));
    act(() => result.current.cancelHide());

    expect(result.current.hideCandidate).toBeNull();
  });

  it("hides a user once confirmed", async () => {
    const { result, refresh, onHidden } = setup();

    await act(() => result.current.toggleVisibility("u-1"));
    await act(() => result.current.confirmHide());

    expect(api.toggleUserVisibility).toHaveBeenCalledWith("u-1");
    expect(onHidden).toHaveBeenCalledWith("u-1");
    expect(refresh).toHaveBeenCalled();
    expect(result.current.hideCandidate).toBeNull();
    expect(lastToast()).toMatchObject({ title: "User hidden" });
  });

  it("does nothing when there is nobody to hide", async () => {
    const { result } = setup();

    await act(() => result.current.confirmHide());

    expect(api.toggleUserVisibility).not.toHaveBeenCalled();
  });

  it("reports a hide that fails", async () => {
    api.toggleUserVisibility.mockRejectedValue(new Error("offline"));
    const { result, onHidden } = setup();

    await act(() => result.current.toggleVisibility("u-1"));
    await act(() => result.current.confirmHide());

    expect(onHidden).not.toHaveBeenCalled();
    expect(result.current.hideCandidate).toBeNull();
    expect(lastToast()).toMatchObject({ description: "Failed to hide user" });
  });

  it("shows a hidden user straight away and reloads the hidden list", async () => {
    api.getHiddenUsers.mockResolvedValue([preference({ hidden: true })]);
    const { result, refresh } = setup([]);
    act(() => result.current.setHiddenUsersOpen(true));
    await waitFor(() => expect(result.current.hiddenUsers).toHaveLength(1));

    api.getHiddenUsers.mockResolvedValue([]);
    await act(() => result.current.toggleVisibility("u-1"));

    expect(api.toggleUserVisibility).toHaveBeenCalledWith("u-1");
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(result.current.hiddenUsers).toHaveLength(0));
    expect(lastToast()).toMatchObject({
      title: "User shown",
      description: "alex is back in the main user list",
    });
  });

  it("reports a show that fails", async () => {
    api.toggleUserVisibility.mockRejectedValue(new Error("offline"));
    const { result, refresh } = setup([preference({ hidden: true })]);

    await act(() => result.current.toggleVisibility("u-1"));

    expect(refresh).not.toHaveBeenCalled();
    expect(lastToast()).toMatchObject({
      description: "Failed to update user visibility",
    });
  });
});
