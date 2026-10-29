import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { useLoginForm } from "./useLoginForm";

const login = jest.fn<Promise<void>, [string, string, string | undefined]>();
const captchaToken = jest.fn<string | undefined, []>();
const onFailure = jest.fn();
const preventDefault = jest.fn();
const event = { preventDefault } as Pick<FormEvent, "preventDefault">;

const setup = () =>
  renderHook(() => useLoginForm({ login, captchaToken, onFailure }));

const submit = async (result: ReturnType<typeof setup>["result"]) => {
  await act(async () => {
    await result.current.submit(event);
  });
};

const fill = (result: ReturnType<typeof setup>["result"]) => {
  act(() => {
    result.current.change("username", "admin");
    result.current.change("password", "secret");
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  login.mockResolvedValue(undefined);
  captchaToken.mockReturnValue(undefined);
});

describe("useLoginForm", () => {
  it("requires both fields before signing in", async () => {
    const { result } = setup();

    await submit(result);

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.errors).toEqual({
      username: "Username or email is required",
      password: "Password is required",
    });
    expect(login).not.toHaveBeenCalled();
  });

  it("reports only the missing field", async () => {
    const { result } = setup();
    act(() => result.current.change("username", "admin"));

    await submit(result);

    expect(result.current.errors).toEqual({
      password: "Password is required",
    });
  });

  it("clears a field's error once it changes", async () => {
    const { result } = setup();
    await submit(result);

    act(() => result.current.change("username", "a"));

    expect(result.current.errors.username).toBeUndefined();
    expect(result.current.errors.password).toBe("Password is required");
  });

  it("signs in with the captcha token", async () => {
    captchaToken.mockReturnValue("token");
    const { result } = setup();
    fill(result);

    await submit(result);

    expect(login).toHaveBeenCalledWith("admin", "secret", "token");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.loginError).toBe("");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("shows why sign-in failed and resets the captcha", async () => {
    login.mockRejectedValue(new Error("Account locked"));
    const { result } = setup();
    fill(result);

    await submit(result);

    expect(result.current.loginError).toBe("Account locked");
    expect(onFailure).toHaveBeenCalled();
  });

  it("falls back to invalid credentials for an unknown failure", async () => {
    login.mockRejectedValue("nope");
    const { result } = setup();
    fill(result);

    await submit(result);

    expect(result.current.loginError).toBe("Invalid credentials");
  });

  it("keeps the sign-in error while the user retypes", async () => {
    login.mockRejectedValue(new Error("Account locked"));
    const { result } = setup();
    fill(result);
    await submit(result);

    act(() => result.current.change("password", "other"));

    expect(result.current.loginError).toBe("Account locked");
  });

  it("keeps the sign-in error until the next attempt answers", async () => {
    let fail: (error: Error) => void = () => {};
    login.mockRejectedValueOnce(new Error("Account locked"));
    login.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (fail = reject)),
    );
    const { result } = setup();
    fill(result);
    await submit(result);

    let retry: Promise<void> = Promise.resolve();
    act(() => {
      retry = result.current.submit(event);
    });

    expect(result.current.isSubmitting).toBe(true);
    expect(result.current.loginError).toBe("Account locked");
    await act(async () => {
      fail(new Error("Invalid credentials"));
      await retry;
    });
    expect(result.current.loginError).toBe("Invalid credentials");
  });

  it("clears the sign-in error once the next attempt succeeds", async () => {
    login.mockRejectedValueOnce(new Error("Account locked"));
    const { result } = setup();
    fill(result);
    await submit(result);

    await submit(result);

    expect(result.current.loginError).toBe("");
  });

  it("is busy while signing in", async () => {
    let finish = () => {};
    login.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const { result } = setup();
    fill(result);

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.submit(event);
    });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.isSubmitting).toBe(false);
  });
});
