import { emailError, passwordError } from "@/lib/profile-validation";

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
