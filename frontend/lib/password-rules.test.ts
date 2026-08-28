import {
  PASSWORD_RULE_LABELS,
  getPasswordRequirements,
  isStrongPassword,
} from "@/lib/password-rules";

describe("getPasswordRequirements", () => {
  it("marks nothing met for an empty password", () => {
    expect(getPasswordRequirements("")).toEqual({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    });
  });

  it("marks everything met for a password that satisfies the backend rule", () => {
    expect(getPasswordRequirements("BrandNewPass1!")).toEqual({
      length: true,
      uppercase: true,
      lowercase: true,
      number: true,
      special: true,
    });
  });

  it("wants twelve characters, not eleven", () => {
    expect(getPasswordRequirements("Abcdefgh1!x").length).toBe(false);
    expect(getPasswordRequirements("Abcdefgh1!xy").length).toBe(true);
  });

  it("refuses a password longer than the column allows", () => {
    expect(getPasswordRequirements(`A1!${"a".repeat(126)}`).length).toBe(false);
  });

  it.each([
    ["uppercase", "brandnewpass1!"],
    ["lowercase", "BRANDNEWPASS1!"],
    ["number", "BrandNewPassX!"],
    ["special", "BrandNewPass12"],
  ] as const)("spots a password with no %s", (rule, password) => {
    expect(getPasswordRequirements(password)[rule]).toBe(false);
  });

  it.each(["!", "@", "#", "$", "%", "^", "&", "*", "_", "-", "~", "|"])(
    "accepts %s as a special character",
    (character) => {
      expect(getPasswordRequirements(character).special).toBe(true);
    },
  );
});

describe("isStrongPassword", () => {
  it("accepts a password that meets every rule", () => {
    expect(isStrongPassword("BrandNewPass1!")).toBe(true);
  });

  it.each(["", "short1!A", "nouppercase1!", "NOLOWERCASE1!", "NoNumbers!!!!"])(
    "rejects %p",
    (password) => {
      expect(isStrongPassword(password)).toBe(false);
    },
  );
});

describe("PASSWORD_RULE_LABELS", () => {
  it("names every rule the checker reports", () => {
    expect(PASSWORD_RULE_LABELS.map((rule) => rule.key).sort()).toEqual(
      Object.keys(getPasswordRequirements("")).sort(),
    );
  });

  it("describes each rule in plain words", () => {
    for (const { label } of PASSWORD_RULE_LABELS) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
