"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/profile/FormError";
import type {
  PasswordFields,
  PasswordForm,
} from "@/hooks/profile/usePasswordForm";

const PASSWORD_INPUTS: {
  key: keyof PasswordFields;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "currentPassword",
    label: "Current password",
    placeholder: "Enter current password",
  },
  {
    key: "newPassword",
    label: "New password",
    placeholder: "Enter new password",
  },
  {
    key: "confirmPassword",
    label: "Confirm password",
    placeholder: "Confirm new password",
  },
];

export function PasswordTab({
  form,
  onCancel,
}: {
  form: PasswordForm;
  onCancel: () => void;
}) {
  const { fields, setField, saving } = form;

  return (
    <form onSubmit={(e) => void form.submit(e)} className="space-y-4">
      {PASSWORD_INPUTS.map(({ key, label, placeholder }) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{label}</Label>
          <Input
            id={key}
            type="password"
            value={fields[key]}
            onChange={(e) => setField(key, e.target.value)}
            placeholder={placeholder}
            disabled={saving}
          />
          {key === "newPassword" && (
            <p className="text-xs text-muted-foreground">
              Must contain uppercase, lowercase, number, and special character.
              Min 12 characters.
            </p>
          )}
        </div>
      ))}

      <div className="flex items-center space-x-2">
        <input
          id="clearSessions"
          type="checkbox"
          checked={form.clearSessions}
          onChange={(e) => form.setClearSessions(e.target.checked)}
          disabled={saving}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <Label
          htmlFor="clearSessions"
          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Force logout from all browsers after password change
        </Label>
      </div>

      <FormError message={form.error} />

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </DialogFooter>
    </form>
  );
}
