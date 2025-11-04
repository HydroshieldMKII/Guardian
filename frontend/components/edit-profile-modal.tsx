"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, X, AlertCircle } from "lucide-react";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileModal({
  open,
  onOpenChange,
}: EditProfileModalProps) {
  const { user, updateProfile, updatePassword } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    avatarUrl: user?.avatarUrl || "",
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [clearSessions, setClearSessions] = useState(true);

  const [showPasswordError, setShowPasswordError] = useState<string | null>(
    null,
  );
  const [showProfileError, setShowProfileError] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setProfileData({
        username: user?.username || "",
        email: user?.email || "",
        avatarUrl: user?.avatarUrl || "",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setClearSessions(true);
      setShowPasswordError(null);
      setShowProfileError(null);
    }
  }, [open, user]);

  const validateEmail = (email: string): { valid: boolean; error?: string } => {
    if (!email) {
      return { valid: true }; // Email is optional
    }
    const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return {
        valid: false,
        error: "Please enter a valid email address",
      };
    }
    return { valid: true };
  };

  const validatePassword = (
    password: string,
  ): { valid: boolean; error?: string } => {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|~]{12,128}$/;
    if (!passwordRegex.test(password)) {
      return {
        valid: false,
        error:
          "Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters.",
      };
    }
    return { valid: true };
  };

  const hasProfileChanges =
    profileData.username !== user?.username ||
    profileData.email !== user?.email ||
    profileData.avatarUrl !== user?.avatarUrl;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowProfileError(null);
    setIsLoading(true);

    try {
      // Validate email if provided
      const emailValidation = validateEmail(profileData.email);
      if (!emailValidation.valid) {
        setShowProfileError(emailValidation.error || "Invalid email");
        setIsLoading(false);
        return;
      }

      const updates: Record<string, any> = {};
      if (profileData.username !== user?.username) {
        updates.username = profileData.username;
      }
      if (profileData.email !== user?.email) {
        updates.email = profileData.email;
      }
      if (profileData.avatarUrl !== user?.avatarUrl) {
        updates.avatarUrl = profileData.avatarUrl;
      }

      await updateProfile(updates);
      toast({
        title: "Success",
        description: "Profile updated successfully",
        variant: "success",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowPasswordError(null);
    setIsLoading(true);

    try {
      // Validate current password is provided
      if (!passwordData.currentPassword) {
        setShowPasswordError("Please enter your current password");
        setIsLoading(false);
        return;
      }

      // Validate new password is provided
      if (!passwordData.newPassword) {
        setShowPasswordError("Please enter a new password");
        setIsLoading(false);
        return;
      }

      // Validate new password complexity
      const validation = validatePassword(passwordData.newPassword);
      if (!validation.valid) {
        setShowPasswordError(validation.error || "Invalid new password");
        setIsLoading(false);
        return;
      }

      // Validate passwords match
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setShowPasswordError("New passwords do not match");
        setIsLoading(false);
        return;
      }

      await updatePassword({
        ...passwordData,
        clearSessions,
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setClearSessions(true); // Reset to default
      toast({
        title: "Success",
        description: "Password updated successfully",
        variant: "success",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setProfileData({ ...profileData, avatarUrl: base64String });
    };
    reader.readAsDataURL(file);
  };

  const getAvatarInitials = () => {
    if (!user) return "?";
    return user.username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {/* Avatar Preview and Upload */}
              <Card className="p-4 flex flex-col items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={profileData.avatarUrl}
                    alt={user?.username}
                  />
                  <AvatarFallback className="text-lg font-semibold">
                    {getAvatarInitials()}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Avatar
                  </Button>
                  {profileData.avatarUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setProfileData({ ...profileData, avatarUrl: "" })
                      }
                      disabled={isLoading}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </Card>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profileData.username}
                  onChange={(e) =>
                    setProfileData({ ...profileData, username: e.target.value })
                  }
                  placeholder="Enter username"
                  disabled={isLoading}
                  minLength={3}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData({ ...profileData, email: e.target.value })
                  }
                  placeholder="Leave empty to remove email"
                  disabled={isLoading}
                  className={
                    showProfileError
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
              </div>
              {showProfileError && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {showProfileError}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !hasProfileChanges}
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password" className="space-y-4">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  placeholder="Enter current password"
                  disabled={isLoading}
                />
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  placeholder="Enter new password"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Must contain uppercase, lowercase, number, and special
                  character. Min 12 characters.
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Confirm new password"
                  disabled={isLoading}
                />
              </div>

              {/* Clear Sessions Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  id="clearSessions"
                  type="checkbox"
                  checked={clearSessions}
                  onChange={(e) => setClearSessions(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label
                  htmlFor="clearSessions"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Clear all other sessions
                </Label>
              </div>

              {/* Error Message */}
              {showPasswordError && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {showPasswordError}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Password
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
