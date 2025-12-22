"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Moon,
  Sun,
  User,
  LogOut,
  Edit,
  AlertTriangle,
  Save,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useVersion } from "@/contexts/version-context";
import { useAuth, isAdminUser, isPlexUser } from "@/contexts/auth-context";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { NotificationMenu } from "@/components/notification-menu";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function Navbar() {
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { versionInfo } = useVersion();
  const { user, userType, logout, setupRequired, isAuthenticated } = useAuth();
  const {
    hasUnsavedChanges,
    showUnsavedWarning,
    setShowUnsavedWarning,
    pendingNavigation,
    setPendingNavigation,
    onSaveAndLeave,
    onDiscardChanges,
  } = useUnsavedChanges();
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();

  const isOnSettingsPage = pathname === "/settings";

  // Hide navbar if setup required, not authenticated, on auth pages, or plex user (portal has own header)
  if (
    setupRequired ||
    !isAuthenticated ||
    pathname === "/login" ||
    pathname === "/setup" ||
    userType === "plex_user"
  ) {
    return null;
  }

  const handleLogoClick = (e: React.MouseEvent) => {
    // Only intercept if on settings page with unsaved changes
    if (isOnSettingsPage && hasUnsavedChanges) {
      e.preventDefault();
      setPendingNavigation("/");
      setShowUnsavedWarning(true);
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedWarning(false);
    setPendingNavigation(null);
  };

  const handleConfirmLeave = () => {
    setShowUnsavedWarning(false);
    if (onDiscardChanges) {
      onDiscardChanges();
    }
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
    setPendingNavigation(null);
  };

  const handleSaveAndLeave = async () => {
    if (onSaveAndLeave) {
      setIsSaving(true);
      try {
        await onSaveAndLeave();
        setShowUnsavedWarning(false);
        if (pendingNavigation) {
          router.push(pendingNavigation);
        }
        setPendingNavigation(null);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Success",
        description: "Logged out successfully",
        variant: "success",
      });
      router.push("/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  // Helper functions to get display values for both user types
  const getDisplayName = () => {
    if (!user) return "";
    if (isAdminUser(user)) return user.username;
    if (isPlexUser(user)) return user.plexUsername;
    return "";
  };

  const getDisplayEmail = () => {
    if (!user) return "";
    if (isAdminUser(user)) return user.email;
    return ""; // Plex users don't have email exposed
  };

  const getAvatarUrl = () => {
    if (!user) return undefined;
    if (isAdminUser(user)) return user.avatarUrl;
    if (isPlexUser(user)) return user.plexThumb;
    return undefined;
  };

  const getAvatarInitials = () => {
    if (!user) return "?";
    const name = getDisplayName();
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          <Link
            href="/"
            onClick={handleLogoClick}
            className="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="flex items-center">
              {/* Light theme logo (dark logo) */}
              <Image
                src="/logo_dark.svg"
                alt="Guardian"
                width={300}
                height={48}
                className="block dark:hidden h-[48px] w-auto"
                priority
              />
              {/* Dark theme logo (light logo) */}
              <Image
                src="/logo_white.svg"
                alt="Guardian"
                width={300}
                height={48}
                className="hidden dark:block h-[48px] w-auto"
                priority
              />
            </div>
          </Link>

          {/* Right side with theme toggle, notifications, settings, and user menu */}
          <div className="flex items-center space-x-0.5 sm:space-x-1">
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-muted transition-colors"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              ) : (
                <Moon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              )}
            </Button>

            {/* Notification Menu */}
            <NotificationMenu />

            {/* Settings Button */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-muted transition-colors relative"
              title="Settings"
            >
              <Link
                href="/settings"
                className="flex items-center justify-center"
              >
                <Settings className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                {versionInfo?.isVersionMismatch && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 sm:h-2.5 sm:w-2.5 bg-red-500 rounded-full border border-background" />
                )}
              </Link>
            </Button>

            {/* User Avatar Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-muted transition-colors ml-1 sm:ml-2"
                    title={getDisplayName()}
                  >
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                      <AvatarImage
                        src={getAvatarUrl()}
                        alt={getDisplayName()}
                      />
                      <AvatarFallback className="text-[10px] sm:text-xs font-semibold">
                        {getAvatarInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* User Info */}
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={getAvatarUrl()}
                          alt={getDisplayName()}
                        />
                        <AvatarFallback className="text-sm font-semibold">
                          {getAvatarInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getDisplayName()}
                        </p>
                        {getDisplayEmail() && (
                          <p className="text-xs text-muted-foreground truncate">
                            {getDisplayEmail()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Edit Profile */}
                  <DropdownMenuItem
                    onClick={() => setEditProfileOpen(true)}
                    className="cursor-pointer"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit Profile</span>
                  </DropdownMenuItem>

                  {/* Logout */}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-500 focus:text-red-600 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
      />

      {/* Unsaved Changes Warning Modal */}
      <Dialog
        open={showUnsavedWarning}
        onOpenChange={(open) => !open && handleCancelLeave()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes that will be lost if you leave this page.
              What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={handleCancelLeave}
              className="order-1 sm:order-1"
            >
              Stay on Page
            </Button>
            <Button
              onClick={handleSaveAndLeave}
              disabled={isSaving}
              className="order-2 sm:order-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save & Leave
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLeave}
              className="order-3 sm:order-3"
            >
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
