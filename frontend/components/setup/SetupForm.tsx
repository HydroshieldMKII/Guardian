import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthInput } from "@/components/auth-form/AuthInput";
import { PasswordInput } from "@/components/auth-form/PasswordInput";
import { PasswordRequirementList } from "@/components/auth-form/PasswordRequirementList";
import { useAuth } from "@/contexts/auth-context";
import { useSetupForm } from "@/hooks/setup/useSetupForm";
import { SetupEmailInput } from "./SetupEmailInput";

export function SetupForm() {
  const { createAdmin } = useAuth();
  const { values, errors, isSubmitting, change, submit } =
    useSetupForm(createAdmin);

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <AuthInput
        id="username"
        label="Username"
        icon={User}
        type="text"
        placeholder="Choose a username"
        value={values.username}
        onChange={(event) => change("username", event.target.value)}
        disabled={isSubmitting}
        error={errors.username}
      />

      <PasswordInput
        id="password"
        label="Password"
        placeholder="Minimum 12 characters"
        value={values.password}
        onChange={(event) => change("password", event.target.value)}
        disabled={isSubmitting}
        error={errors.password}
        wrapperClassName="space-y-3"
        details={<PasswordRequirementList password={values.password} />}
      />

      <PasswordInput
        id="confirmPassword"
        label="Confirm password"
        placeholder="Re-enter your password"
        value={values.confirmPassword}
        onChange={(event) => change("confirmPassword", event.target.value)}
        disabled={isSubmitting}
        error={errors.confirmPassword}
      />

      <SetupEmailInput
        value={values.email}
        onChange={(event) => change("email", event.target.value)}
        disabled={isSubmitting}
        error={errors.email}
      />

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full mt-2"
        size="lg"
      >
        {isSubmitting ? "Creating..." : "Create administrator account"}
      </Button>
    </form>
  );
}
