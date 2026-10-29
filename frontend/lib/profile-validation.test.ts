import {
  emailError,
  passwordError,
  usernameError,
} from "@/lib/profile-validation";

describe("emailError", () => {
  it.each(["", "someone@example.com", "first.last@sub.example.org"])(
    "accepts %p",
    (email) => {
      expect(emailError(email)).toBeNull();
    },
  );

  it.each(["plain", "missing@tld", "@example.com"])("rejects %p", (email) => {
    expect(emailError(email)).toBe("Please enter a valid email address");
  });
});

describe("passwordError", () => {
  it("accepts a long password with every kind of character", () => {
    expect(passwordError("Abcdefghij1!")).toBeNull();
  });

  it.each([
    "Short1!",
    "abcdefghij1!",
    "ABCDEFGHIJ1!",
    "Abcdefghijk!",
    "Abcdefghijk1",
  ])("rejects %p", (password) => {
    expect(passwordError(password)).toMatch(/^Password must contain/);
  });
});

describe("usernameError", () => {
  it.each(["abc", "testuser", "a".repeat(255)])("accepts %p", (username) => {
    expect(usernameError(username)).toBeNull();
  });

  it.each(["", "   "])("requires a username, got %p", (username) => {
    expect(usernameError(username)).toBe("Username is required");
  });

  it.each(["ab", "  ab  ", "a".repeat(256)])("rejects %p", (username) => {
    expect(usernameError(username)).toBe(
      "Username must be 3 to 255 characters",
    );
  });
});

describe("emailError length", () => {
  it("rejects an address longer than 255 characters", () => {
    expect(emailError(`${"a".repeat(250)}@example.com`)).toBe(
      "Please enter a valid email address",
    );
  });
});
