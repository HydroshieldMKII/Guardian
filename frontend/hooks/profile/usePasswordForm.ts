"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { passwordError } from "@/lib/profile-validation";

export interface PasswordFields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORDS: PasswordFields = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const validationError = (fields: PasswordFields) => {
  if (!fields.currentPassword) return "Please enter your current password";
  if (!fields.newPassword) return "Please enter a new password";
  const weak = passwordError(fields.newPassword);
  if (weak) return weak;
  if (fields.newPassword !== fields.confirmPassword) {
    return "New passwords do not match";
  }
  return null;
};

export function usePasswordForm(open: boolean, onSaved: () => void) {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const [fields, setFields] = useState<PasswordFields>(EMPTY_PASSWORDS);
  const [clearSessions, setClearSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFields(EMPTY_PASSWORDS);
      setClearSessions(true);
      setError(null);
    }
  }, [open]);

  const setField = (key: keyof PasswordFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: Pick<React.FormEvent, "preventDefault">) => {
    event.preventDefault();
    const invalid = validationError(fields);
    setError(invalid);
    if (invalid) return;

    setSaving(true);
    try {
      await updatePassword({ ...fields, clearSessions });
      setFields(EMPTY_PASSWORDS);
      setClearSessions(true);
      toast({
        title: "Success",
        description: "Password updated successfully",
        variant: "success",
      });
      onSaved();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    fields,
    setField,
    clearSessions,
    setClearSessions,
    error,
    saving,
    submit,
  };
}

export type PasswordForm = ReturnType<typeof usePasswordForm>;
