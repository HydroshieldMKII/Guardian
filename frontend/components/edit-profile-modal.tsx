"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordTab } from "@/components/profile/PasswordTab";
import { PlexTab } from "@/components/profile/PlexTab";
import { ProfileTab } from "@/components/profile/ProfileTab";
import { useLinkedPlex } from "@/hooks/profile/useLinkedPlex";
import { usePasswordForm } from "@/hooks/profile/usePasswordForm";
import { useProfileForm } from "@/hooks/profile/useProfileForm";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "password", label: "Password" },
  { value: "plex", label: "Plex" },
];

export function EditProfileModal({
  open,
  onOpenChange,
}: EditProfileModalProps) {
  const close = () => onOpenChange(false);
  const profile = useProfileForm(open, close);
  const password = usePasswordForm(open, close);
  const plex = useLinkedPlex(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value} className="cursor-pointer">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <ProfileTab form={profile} onCancel={close} />
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <PasswordTab form={password} onCancel={close} />
          </TabsContent>

          <TabsContent value="plex" className="space-y-4">
            <PlexTab plex={plex} onClose={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
