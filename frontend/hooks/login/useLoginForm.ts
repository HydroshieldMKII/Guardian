import { useState, type FormEvent } from "react";

export type LoginField = "username" | "password";
type LoginErrors = Partial<Record<LoginField, string>>;

const REQUIRED: Record<LoginField, string> = {
  username: "Username or email is required",
  password: "Password is required",
};

interface LoginFormOptions {
  login: (
    username: string,
    password: string,
    captchaToken?: string,
  ) => Promise<void>;
  captchaToken: () => string | undefined;
  onFailure: () => void;
}

export function useLoginForm({
  login,
  captchaToken,
  onFailure,
}: LoginFormOptions) {
  const [values, setValues] = useState<Record<LoginField, string>>({
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const change = (field: LoginField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const missing: LoginErrors = {};
    for (const field of Object.keys(REQUIRED) as LoginField[]) {
      if (!values[field]) missing[field] = REQUIRED[field];
    }
    setErrors(missing);
    return Object.keys(missing).length === 0;
  };

  const submit = async (event: Pick<FormEvent, "preventDefault">) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(values.username, values.password, captchaToken());
      setLoginError("");
    } catch (error) {
      onFailure();
      setLoginError(
        error instanceof Error ? error.message : "Invalid credentials",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return { values, errors, loginError, isSubmitting, change, submit };
}
