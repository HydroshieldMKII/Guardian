import { act, renderHook } from "@testing-library/react";
import { useSessionDeletion } from "./useSessionDeletion";
import { sessionHistoryApi } from "@/lib/session-history-api";

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const entry = { id: 4, sessionKey: "s-4", userId: "u-1", startedAt: "" };

beforeEach(() => jest.clearAllMocks());

describe("useSessionDeletion", () => {
  it("deletes nothing before a session is chosen", async () => {
    const remove = jest.spyOn(sessionHistoryApi, "remove");
    const removeSession = jest.fn();
    const { result } = renderHook(() => useSessionDeletion(removeSession));

    await act(() => result.current.confirm());

    expect(remove).not.toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
  });

  it("forgets the chosen session on cancel", () => {
    const { result } = renderHook(() => useSessionDeletion(jest.fn()));

    act(() => result.current.request(entry));
    expect(result.current.pending).toBe(entry);

    act(() => result.current.cancel());
    expect(result.current.pending).toBeNull();
  });
});
