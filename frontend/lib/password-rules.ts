export interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export const PASSWORD_RULE_LABELS: {
  key: keyof PasswordRequirements;
  label: string;
}[] = [
  { key: "length", label: "At least 12 characters" },
  { key: "uppercase", label: "Uppercase letter (A-Z)" },
  { key: "lowercase", label: "Lowercase letter (a-z)" },
  { key: "number", label: "Number (0-9)" },
  { key: "special", label: "Special character (!@#$...)" },
];

export function getPasswordRequirements(
  password: string,
): PasswordRequirements {
  return {
    length: password.length >= 12 && password.length <= 128,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~]/.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  return Object.values(getPasswordRequirements(password)).every(Boolean);
}
