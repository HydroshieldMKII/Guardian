import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { useSetupForm, validateSetup, type SetupValues } from "./useSetupForm";

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

const createAdmin = jest.fn<Promise<void>, [string, string, string, string]>();
const preventDefault = jest.fn();
const event = { preventDefault } as Pick<FormEvent, "preventDefault">;
const STRONG = "Str0ng!Passw0rd";

const valid: SetupValues = {
  username: "admin",
  email: "",
  password: STRONG,
  confirmPassword: STRONG,
};

const setup = () => renderHook(() => useSetupForm(createAdmin));

const fill = (
  result: ReturnType<typeof setup>["result"],
  values: SetupValues,
) => {
  act(() => {
    for (const [field, value] of Object.entries(values)) {
      result.current.change(field as keyof SetupValues, value);
    }
  });
};

const submit = async (result: ReturnType<typeof setup>["result"]) => {
  await act(async () => {
    await result.current.submit(event);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  createAdmin.mockResolvedValue(undefined);
});

describe("validateSetup", () => {
  it("accepts a complete form", () => {
    expect(validateSetup(valid)).toEqual({});
  });

  it("accepts a valid optional email", () => {
    expect(validateSetup({ ...valid, email: "admin@example.com" })).toEqual({});
  });

  it("reports every invalid field", () => {
    expect(
      validateSetup({
        username: "ab",
        email: "not-an-email",
        password: "",
        confirmPassword: "x",
      }),
    ).toEqual({
      username: "Username must be at least 3 characters",
      email: "Enter a valid email address",
      password: "Password must meet every requirement listed below",
      confirmPassword: "Passwords do not match",
    });
  });

  it("reports a short password that meets the complexity rules", () => {
    expect(
      validateSetup({ ...valid, password: "Ab1!", confirmPassword: "Ab1!" }),
    ).toEqual({ password: "Password must be at least 12 characters" });
  });

  it.each(["abcdefgh1!xy", "ABCDEFGH1!XY", "Abcdefghij!x", "Abcdefghij1x"])(
    "requires every character class in %s",
    (password) => {
      expect(
        validateSetup({ ...valid, password, confirmPassword: password })
          .password,
      ).toBe("Password must meet every requirement listed below");
    },
  );
});

describe("useSetupForm", () => {
  it("shows errors without creating the account", async () => {
    const { result } = setup();

    await submit(result);

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.errors.username).toBe(
      "Username must be at least 3 characters",
    );
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("clears a field's error once it changes", async () => {
    const { result } = setup();
    await submit(result);

    act(() => result.current.change("username", "a"));

    expect(result.current.errors.username).toBeUndefined();
    expect(result.current.errors.password).toBeDefined();
  });

  it("creates the administrator account", async () => {
    const { result } = setup();
    fill(result, { ...valid, email: "admin@example.com" });

    await submit(result);

    expect(createAdmin).toHaveBeenCalledWith(
      "admin",
      "admin@example.com",
      STRONG,
      STRONG,
    );
    expect(toast).toHaveBeenCalledWith({
      title: "Account created",
      description: "You are signed in as the administrator",
      variant: "success",
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("is submitting while the account is created", async () => {
    let finish = () => {};
    createAdmin.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = setup();
    fill(result, valid);

    let pending = Promise.resolve();
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

  it("shows the backend error", async () => {
    createAdmin.mockRejectedValue(new Error("Username taken"));
    const { result } = setup();
    fill(result, valid);

    await submit(result);

    expect(toast).toHaveBeenCalledWith({
      title: "Error",
      description: "Username taken",
      variant: "destructive",
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("falls back to a generic error", async () => {
    createAdmin.mockRejectedValue("boom");
    const { result } = setup();
    fill(result, valid);

    await submit(result);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Failed to create the administrator account",
      }),
    );
  });
});
