export const EMAIL_PATTERN = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~]{12,128}$/;

export const USERNAME_MIN_LENGTH = 3;
export const PROFILE_FIELD_MAX_LENGTH = 255;

export const emailError = (email: string): string | null =>
  !email ||
  (EMAIL_PATTERN.test(email) && email.length <= PROFILE_FIELD_MAX_LENGTH)
    ? null
    : "Please enter a valid email address";

export const usernameError = (username: string): string | null => {
  const length = username.trim().length;
  if (length === 0) return "Username is required";
  if (length < USERNAME_MIN_LENGTH || length > PROFILE_FIELD_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH} to ${PROFILE_FIELD_MAX_LENGTH} characters`;
  }
  return null;
};

export const passwordError = (password: string): string | null =>
  STRONG_PASSWORD_PATTERN.test(password)
    ? null
    : "Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters.";
