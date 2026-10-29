export const EMAIL_PATTERN = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~]{12,128}$/;

export const emailError = (email: string): string | null =>
  !email || EMAIL_PATTERN.test(email)
    ? null
    : "Please enter a valid email address";

export const passwordError = (password: string): string | null =>
  STRONG_PASSWORD_PATTERN.test(password)
    ? null
    : "Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters.";
