import { act, renderHook } from "@testing-library/react";
import { useStoredChoice } from "@/hooks/use-stored-choice";

const KEY = "test-choice";

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("useStoredChoice", () => {
  it("starts from the fallback and stores it", () => {
    const { result } = renderHook(() =>
      useStoredChoice<"asc" | "desc">(KEY, "asc"),
    );

    expect(result.current[0]).toBe("asc");
    expect(localStorage.getItem(KEY)).toBe("asc");
  });

  it("starts from a stored choice", () => {
    localStorage.setItem(KEY, "desc");

    const { result } = renderHook(() =>
      useStoredChoice<"asc" | "desc">(KEY, "asc"),
    );

    expect(result.current[0]).toBe("desc");
  });

  it("stores a new choice", () => {
    const { result } = renderHook(() =>
      useStoredChoice<"asc" | "desc">(KEY, "asc"),
    );

    act(() => result.current[1]("desc"));

    expect(result.current[0]).toBe("desc");
    expect(localStorage.getItem(KEY)).toBe("desc");
  });

  it("keeps working when storage is unavailable", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() =>
      useStoredChoice<"asc" | "desc">(KEY, "asc"),
    );
    act(() => result.current[1]("desc"));

    expect(result.current[0]).toBe("desc");
  });
});
