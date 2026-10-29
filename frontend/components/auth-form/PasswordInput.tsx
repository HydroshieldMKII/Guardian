import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { AuthInput } from "./AuthInput";

type PasswordInputProps = Omit<
  ComponentProps<typeof AuthInput>,
  "type" | "icon" | "trailing"
>;

export function PasswordInput({ disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Toggle = visible ? EyeOff : Eye;

  return (
    <AuthInput
      {...props}
      icon={Lock}
      type={visible ? "text" : "password"}
      disabled={disabled}
      className="pr-10"
      trailing={
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          disabled={disabled}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Toggle className="h-4 w-4" />
        </button>
      }
    />
  );
}
