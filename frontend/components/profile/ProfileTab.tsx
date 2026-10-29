"use client";

import { useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, StatusPill } from "@/components/ui/entity";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/profile/FormError";
import type { ProfileForm } from "@/hooks/profile/useProfileForm";

export function ProfileTab({
  form,
  onCancel,
}: {
  form: ProfileForm;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { fields, setField, saving } = form;

  return (
    <form onSubmit={(e) => void form.submit(e)} className="space-y-4">
      <Card className="p-4 flex flex-col items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={fields.avatarUrl} alt={form.displayName} />
          <AvatarFallback className="text-lg font-semibold">
            {form.initials}
          </AvatarFallback>
        </Avatar>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={form.uploadAvatar}
          className="hidden"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload avatar
          </Button>
          {fields.avatarUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setField("avatarUrl", "")}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={fields.username}
          onChange={(e) => setField("username", e.target.value)}
          placeholder="Enter username"
          disabled={saving}
          minLength={3}
        />
      </div>

      <Field
        label="Email"
        htmlFor="email"
        action={<StatusPill tone="neutral">Optional</StatusPill>}
      >
        <Input
          id="email"
          type="email"
          value={fields.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="Leave empty to remove email"
          disabled={saving}
          className={
            form.error ? "border-red-500 focus-visible:ring-red-500" : ""
          }
        />
      </Field>
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
        <Button type="submit" disabled={saving || !form.hasChanges}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
