"use client";

import { useEffect, useState } from "react";
import { isAdminUser, useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { emailError, usernameError } from "@/lib/profile-validation";

export interface ProfileFields {
  username: string;
  email: string;
  avatarUrl: string;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const EMPTY_PROFILE: ProfileFields = { username: "", email: "", avatarUrl: "" };

const initialsOf = (username: string) =>
  username
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

export function useProfileForm(open: boolean, onSaved: () => void) {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const admin = user && isAdminUser(user) ? user : null;
  const [fields, setFields] = useState<ProfileFields>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && admin) {
      setFields({
        username: admin.username,
        email: admin.email,
        avatarUrl: admin.avatarUrl || "",
      });
    }
    if (!open) {
      setError(null);
    }
  }, [open, admin]);

  const setField = (key: keyof ProfileFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const usernameFieldError = admin ? usernameError(fields.username) : null;

  const hasChanges = Boolean(
    admin &&
    (fields.username !== admin.username ||
      fields.email !== admin.email ||
      fields.avatarUrl !== admin.avatarUrl),
  );

  const submit = async (event: Pick<React.FormEvent, "preventDefault">) => {
    event.preventDefault();
    if (usernameFieldError) return;
    const invalid = emailError(fields.email);
    setError(invalid);
    if (invalid) return;

    setSaving(true);
    try {
      const updates: Parameters<typeof updateProfile>[0] = {};
      if (admin) {
        if (fields.username !== admin.username) {
          updates.username = fields.username;
        }
        if (fields.email !== admin.email) {
          updates.email = fields.email;
        }
        if (fields.avatarUrl !== admin.avatarUrl) {
          updates.avatarUrl = fields.avatarUrl;
        }
      }
      await updateProfile(updates);
      toast({
        title: "Success",
        description: "Profile updated successfully",
        variant: "success",
      });
      onSaved();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      toast({
        title: "File too large",
        description: "Image must be smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setField("avatarUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  return {
    fields,
    setField,
    error,
    usernameError: usernameFieldError,
    saving,
    hasChanges,
    submit,
    uploadAvatar,
    displayName: admin ? admin.username : "User",
    initials: admin ? initialsOf(admin.username) : "?",
  };
}

export type ProfileForm = ReturnType<typeof useProfileForm>;
