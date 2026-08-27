"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth, isAdminUser } from "@/contexts/auth-context";
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
import { Field, StatusPill } from "@/components/ui/entity";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, X, AlertCircle, Link2, Unlink } from "lucide-react";
import { usePlexOAuth } from "@/hooks/use-plex-oauth";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileModal({
  open,
  onOpenChange,
}: EditProfileModalProps) {
  const {
    user,
    updateProfile,
    updatePassword,
    linkPlexAccount,
    unlinkPlexAccount,
  } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    avatarUrl: "",
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [clearSessions, setClearSessions] = useState(true);

  const [showPasswordError, setShowPasswordError] = useState<string | null>(
    null
  );
  const [showProfileError, setShowProfileError] = useState<string | null>(null);

  // Plex linking state
  const [unlinkingPlex, setUnlinkingPlex] = useState(false);

  // Fresh user data fetched when modal opens
  const [freshUserData, setFreshUserData] = useState<{
    plexUserId?: string;
    plexUsername?: string;
    plexThumb?: string;
  } | null>(null);

  // Fetch fresh user data when modal opens
  useEffect(() => {
    if (open && user && isAdminUser(user)) {
      // Fetch fresh user data to get Plex account info
      fetch("/api/pg/auth/me", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setFreshUserData({
              plexUserId: data.plexUserId,
              plexUsername: data.plexUsername,
              plexThumb: data.plexThumb,
            });
          }
        })
        .catch(() => {
          // Ignore errors, fall back to user from context
        });
    }
    if (!open) {
      setFreshUserData(null);
    }
  }, [open, user]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open && user && isAdminUser(user)) {
      setProfileData({
        username: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "",
      });
    }
    if (!open) {
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setClearSessions(true);
      setShowPasswordError(null);
      setShowProfileError(null);
      cancelPlexLinkRef.current();
    }
  }, [open, user]);

  const {
    loading: linkingPlex,
    waiting: waitingForPlex,
    start: handlePlexLink,
    cancel: cancelPlexLink,
  } = usePlexOAuth({
    onAuthenticated: linkPlexAccount,
    copy: {
      success: {
        title: "Plex Account Linked",
        description: "You can now sign in with Plex",
      },
      failed: {
        title: "Plex Link Failed",
        description: "Could not link your Plex account",
      },
      expired: {
        title: "Plex Link Expired",
        description: "The Plex window timed out. Start again to retry.",
      },
      cancelled: {
        title: "Plex Link Cancelled",
        description: "The Plex window closed before the account was linked",
      },
    },
  });

  const cancelPlexLinkRef = useRef(cancelPlexLink);
  cancelPlexLinkRef.current = cancelPlexLink;

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
    password: string
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
    user &&
    isAdminUser(user) &&
    (profileData.username !== user.username ||
      profileData.email !== user.email ||
      profileData.avatarUrl !== user.avatarUrl);

  const handlePlexUnlink = async () => {
    setUnlinkingPlex(true);
    try {
      await unlinkPlexAccount();
      toast({
        title: "Plex Account Unlinked",
        description: "Signing in with Plex is no longer available for this account",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Unlink Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to unlink Plex account",
        variant: "destructive",
      });
    } finally {
      setUnlinkingPlex(false);
    }
  };

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
      if (user && isAdminUser(user)) {
        if (profileData.username !== user.username) {
          updates.username = profileData.username;
        }
        if (profileData.email !== user.email) {
          updates.email = profileData.email;
        }
        if (profileData.avatarUrl !== user.avatarUrl) {
          updates.avatarUrl = profileData.avatarUrl;
        }
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
    if (isAdminUser(user)) {
      return user.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    }
    return "?";
  };

  // Get linked Plex info for admin users - prefer freshUserData over context user
  const linkedPlex = freshUserData?.plexUserId
    ? {
        plexUserId: freshUserData.plexUserId,
        plexUsername: freshUserData.plexUsername,
        plexThumb: freshUserData.plexThumb,
      }
    : user && isAdminUser(user) && user.plexUserId
      ? {
          plexUserId: user.plexUserId,
          plexUsername: user.plexUsername,
          plexThumb: user.plexThumb,
        }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="cursor-pointer">
              Profile
            </TabsTrigger>
            <TabsTrigger value="password" className="cursor-pointer">
              Password
            </TabsTrigger>
            <TabsTrigger value="plex" className="cursor-pointer">
              Plex
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {/* Avatar Preview and Upload */}
              <Card className="p-4 flex flex-col items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={profileData.avatarUrl}
                    alt={user && isAdminUser(user) ? user.username : "User"}
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
              <Field
                label="Email"
                htmlFor="email"
                action={<StatusPill tone="neutral">Optional</StatusPill>}
              >
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
              </Field>
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
                  Force logout from all browsers after password change
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

          {/* Plex Tab */}
          <TabsContent value="plex" className="space-y-4">
            <div className="space-y-4">
              {linkedPlex ? (
                <>
                  {/* Linked Plex Account */}
                  <Card className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        {linkedPlex.plexThumb && (
                          <AvatarImage
                            src={linkedPlex.plexThumb}
                            alt={linkedPlex.plexUsername || "Plex User"}
                          />
                        )}
                        <AvatarFallback className="bg-[#e5a00d]">
                          <img
                            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAADDklEQVR4nO2dPWxOURjHfz5S7UCURKiEsEiYDBYGs8FKLKiOEiaCdjBZWEzslXTSdmqYDa2PVGLwObVdJE20vBUaH0eOXBOGc3M+nnvf/y/57//n+ee97733POdcEEIIIYQQQgghhBAinC3AOWASeA2sAK4lWqlqmgAGgX4M0QcMAx8NNMpl0jJwtaq9KAPAEwMNcYX0HNhVqvk7gQUDTXCFtVD1Iiv+p/fMQPHOiPxVoDdnACMGinbGdCXn3c6ygYKdMS3lujsaMlCsM6qzOQKYNFCoM6rxHAG8M1CoMyr/sJacjoFCnVH53iSndJHOuBQACqCrlZzUBYwBewN1w0DjWxPAD+BwoKf1wKyB5rciAAe8AHoCfR0EvimAeBqp4e2mAoinr8D+QG8bgJcKIJ6mgbWB/o4CPxVAPJ2v4fGOAoi7IL4n0OMmYE4BxNNUDZ/HFEBcnarhdVQBxNMisC3Q61bgvQKIp9Eafk8ogLg6XsPzfQUQT3PAxkDP24EPCiCebtfw7edWFUDEN6ZHanh/oADi6VWNabTdwCcFEE/Xa/i/oADiaRU4EOjfv9x7pADiaQZYF1jDPuCLAiCa/GUllGsKgGj6XC3Oh64jpxixT07pZjsF0I5L0HAiL8lxxjSjP+FyWtVtaPMexC4m9pQc1/BXER0FUOZl3BrgYQZvyXENfR09lMlbcpq4ILNDCzJllyTHM/pLTtMW5U9m9picUs1f1FhK8waz7hXwmZwSzZ+q4VOjiYWHc+cVQLnx9LuFmt+6AKa1QeNvLG9R6gPeFmy+6/ZNercKN7+rt6keAr4rgDIbtXuq0Eo3vxUBjOmogrIBuIZLAaAAulrJ0ZFl/Ff+/OzkvDFQqDMqPyiQnAkDhTqj8psBkzNooFBnVKdzBOCP59XRxfzz6OLNZCLVbL1rsC6RET+R9tRA0c6IHuc+vt6jDzjwW/PVl0SKMFCl77pUsyU/YfKH3urjBUsGGuIyydd6uTqjzgz91fn549UDSZuemDtVTb62MznvdoQQQgghhBBCCCEEreEXCfyL3FOHoLAAAAAASUVORK5CYII="
                            alt="Plex"
                            className="h-6 w-6"
                          />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {linkedPlex.plexUsername || "Plex User"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Linked Plex Account
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Button
                    variant="destructive"
                    onClick={() => handlePlexUnlink()}
                    disabled={unlinkingPlex}
                    className="w-full"
                  >
                    {unlinkingPlex ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="mr-2 h-4 w-4" />
                    )}
                    Unlink Plex Account
                  </Button>
                </>
              ) : (
                <>
                  {/* No Plex Account Linked */}
                  <Card className="p-4 border-dashed">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <p className="text-sm text-muted-foreground">
                        No Plex account linked
                      </p>
                    </div>
                  </Card>

                  <Button
                    onClick={() => handlePlexLink()}
                    disabled={linkingPlex}
                    className="w-full bg-[#e5a00d] hover:bg-[#cc8f0c] text-black border-[#e5a00d] hover:border-[#cc8f0c]"
                  >
                    {linkingPlex ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Waiting for Plex...
                      </>
                    ) : (
                      <>
                        <img
                          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAADDklEQVR4nO2dPWxOURjHfz5S7UCURKiEsEiYDBYGs8FKLKiOEiaCdjBZWEzslXTSdmqYDa2PVGLwObVdJE20vBUaH0eOXBOGc3M+nnvf/y/57//n+ee97733POdcEEIIIYQQQgghhBAinC3AOWASeA2sAK4lWqlqmgAGgX4M0QcMAx8NNMpl0jJwtaq9KAPAEwMNcYX0HNhVqvk7gQUDTXCFtVD1Iiv+p/fMQPHOiPxVoDdnACMGinbGdCXn3c6ygYKdMS3lujsaMlCsM6qzOQKYNFCoM6rxHAG8M1CoMyr/sJacjoFCnVH53iSndJHOuBQACqCrlZzUBYwBewN1w0DjWxPAD+BwoKf1wKyB5rciAAe8AHoCfR0EvimAeBqp4e2mAoinr8D+QG8bgJcKIJ6mgbWB/o4CPxVAPJ2v4fGOAoi7IL4n0OMmYE4BxNNUDZ/HFEBcnarhdVQBxNMisC3Q61bgvQKIp9Eafk8ogLg6XsPzfQUQT3PAxkDP24EPCiCebtfw7edWFUDEN6ZHanh/oADi6VWNabTdwCcFEE/Xa/i/oADiaRU4EOjfv9x7pADiaQZYF1jDPuCLAiCa/GUllGsKgGj6XC3Oh64jpxixT07pZjsF0I5L0HAiL8lxxjSjP+FyWtVtaPMexC4m9pQc1/BXER0FUOZl3BrgYQZvyXENfR09lMlbcpq4ILNDCzJllyTHM/pLTtMW5U9m9picUs1f1FhK8waz7hXwmZwSzZ+q4VOjiYWHc+cVQLnx9LuFmt+6AKa1QeNvLG9R6gPeFmy+6/ZNercKN7+rt6keAr4rgDIbtXuq0Eo3vxUBjOmogrIBuIZLAaAAulrJ0ZFl/Ff+/OzkvDFQqDMqPyiQnAkDhTqj8psBkzNooFBnVKdzBOCP59XRxfzz6OLNZCLVbL1rsC6RET+R9tRA0c6IHuc+vt6jDzjwW/PVl0SKMFCl77pUsyU/YfKH3urjBUsGGuIyydd6uTqjzgz91fn549UDSZuemDtVTb62MznvdoQQQgghhBBCCCEEreEXCfyL3FOHoLAAAAAASUVORK5CYII="
                          alt="Plex"
                          className="mr-2 h-4 w-4"
                        />
                        Link Plex Account
                      </>
                    )}
                  </Button>

                  {waitingForPlex && (
                    <p className="text-center text-xs text-muted-foreground">
                      Finish linking on the Plex window, or{" "}
                      <button
                        type="button"
                        onClick={() => cancelPlexLink()}
                        className="cursor-pointer underline underline-offset-2 hover:text-foreground"
                      >
                        cancel
                      </button>
                      .
                    </p>
                  )}
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
