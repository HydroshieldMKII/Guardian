import { useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { getPasswordRequirements } from "@/lib/password-rules";
import { EMAIL_PATTERN } from "@/lib/profile-validation";
import { errorMessage } from "@/lib/utils";

export type SetupField = "username" | "email" | "password" | "confirmPassword";
export type SetupValues = Record<SetupField, string>;
export type SetupErrors = Partial<Record<SetupField, string>>;

type CreateAdmin = (
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
) => Promise<void>;

const EMPTY: SetupValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 12;

function passwordError(password: string) {
  const { uppercase, lowercase, number, special } =
    getPasswordRequirements(password);
  if (!uppercase || !lowercase || !number || !special) {
    return "Password must meet every requirement listed below";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Password must be at least 12 characters";
  }
  return undefined;
}

export function validateSetup(values: SetupValues): SetupErrors {
  const errors: SetupErrors = {};
  if (values.username.length < MIN_USERNAME_LENGTH) {
    errors.username = "Username must be at least 3 characters";
  }
  if (values.email && !EMAIL_PATTERN.test(values.email)) {
    errors.email = "Enter a valid email address";
  }
  const password = passwordError(values.password);
  if (password) errors.password = password;
  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }
  return errors;
}

export function useSetupForm(createAdmin: CreateAdmin) {
  const { toast } = useToast();
  const [values, setValues] = useState<SetupValues>(EMPTY);
  const [errors, setErrors] = useState<SetupErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const change = (field: SetupField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: Pick<FormEvent, "preventDefault">) => {
    event.preventDefault();
    const found = validateSetup(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSubmitting(true);
    try {
      await createAdmin(
        values.username,
        values.email,
        values.password,
        values.confirmPassword,
      );
      toast({
        title: "Account created",
        description: "You can sign in with it now",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: errorMessage(
          error,
          "Failed to create the administrator account",
        ),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { values, errors, isSubmitting, change, submit };
}
