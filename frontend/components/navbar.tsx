"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Moon, Sun, User, LogOut, Edit } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useVersion } from "@/contexts/version-context";
import { useAuth } from "@/contexts/auth-context";
import { NotificationMenu } from "@/components/notification-menu";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  const { theme, toggleTheme } = useTheme();
  const { versionInfo } = useVersion();
  const { user, logout, setupRequired, isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();

  // Hide navbar if setup required, not authenticated, or on auth pages
  if (
    setupRequired ||
    !isAuthenticated ||
    pathname === "/login" ||
    pathname === "/setup"
  ) {
    return null;
  }

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
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="flex items-center">
              {/* Light theme logo (dark logo) */}
              <Image
                src="/logo_dark.svg"
                alt="Guardian"
                width={300}
                height={48}
                className="block dark:hidden"
                style={{ height: "64px", width: "auto" }}
                priority
              />
              {/* Dark theme logo (light logo) */}
              <Image
                src="/logo_white.svg"
                alt="Guardian"
                width={300}
                height={48}
                className="hidden dark:block"
                style={{ height: "64px", width: "auto" }}
                priority
              />
            </div>
          </Link>

          {/* Right side with theme toggle, notifications, settings, and user menu */}
          <div className="flex items-center space-x-1">
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-full hover:bg-muted transition-colors"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </Button>

            {/* Notification Menu */}
            <NotificationMenu />

            {/* Settings Button */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-9 w-9 rounded-full hover:bg-muted transition-colors relative"
              title="Settings"
            >
              <Link
                href="/settings"
                className="flex items-center justify-center"
              >
                <Settings className="h-[18px] w-[18px]" />
                {versionInfo?.isVersionMismatch && (
                  <div className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border border-background" />
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
                    className="h-9 w-9 rounded-full hover:bg-muted transition-colors ml-2"
                    title={user.username}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                      <AvatarFallback className="text-xs font-semibold">
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
                        <AvatarImage src={user.avatarUrl} alt={user.username} />
                        <AvatarFallback className="text-sm font-semibold">
                          {getAvatarInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.username}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
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
    </nav>
  );
}
