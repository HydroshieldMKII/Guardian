"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MonitorPlay,
  Users,
  Settings,
  Moon,
  Sun,
  LogOut,
  Edit,
  AlertTriangle,
  Save,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useVersionInfo } from "@/hooks/useVersionInfo";
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
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useDashboardQuery } from "@/hooks/useDashboardQuery";
import {
  dashboardCounts,
  dashboardHref,
  resolveDashboardView,
} from "@/lib/dashboard-view";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { versionInfo } = useVersionInfo();
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
  const searchParams = useSearchParams();

  const hidden =
    setupRequired ||
    !isAuthenticated ||
    pathname === "/login" ||
    pathname === "/setup" ||
    userType === "plex_user";
  const { data: dashboardData } = useDashboardQuery(
    !hidden && pathname !== "/",
  );

  if (hidden) {
    return null;
  }

  const isOnSettingsPage = pathname === "/settings";
  const { pendingDevices, activeStreams } = dashboardCounts(dashboardData);

  const guardNavigation = (e: React.MouseEvent, href: string) => {
    if (isOnSettingsPage && hasUnsavedChanges && href !== "/settings") {
      e.preventDefault();
      setPendingNavigation(href);
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
      } catch {
        toast({
          title: "Error",
          description: "Failed to save your changes",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Signed out",
        description: "You have been signed out",
        variant: "success",
      });
      router.push("/login");
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const getDisplayName = () => {
    if (!user) return "";
    if (isAdminUser(user)) return user.username;
    if (isPlexUser(user)) return user.plexUsername;
    return "";
  };

  const getDisplayEmail = () => {
    if (!user) return "";
    if (isAdminUser(user)) return user.email;
    return "";
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

  const navItems: {
    key: "streams" | "users" | "settings";
    label: string;
    href: string;
    icon: typeof Settings;
    count?: number;
    countTone?: "waiting" | "info";
    dot?: boolean;
  }[] = [
    {
      key: "users",
      label: "Users",
      href: dashboardHref("users"),
      icon: Users,
      count: pendingDevices,
      countTone: "waiting",
    },
    {
      key: "streams",
      label: "Streams",
      href: dashboardHref("streams"),
      icon: MonitorPlay,
      count: activeStreams,
      countTone: "info",
    },
    {
      key: "settings",
      label: "Settings",
      href: "/settings",
      icon: Settings,
      dot: Boolean(versionInfo?.isVersionMismatch),
    },
  ];

  const dashboardView = resolveDashboardView(
    searchParams.get("view"),
    dashboardData,
  );
  const activeKey =
    pathname === "/settings"
      ? "settings"
      : pathname === "/"
        ? dashboardView
        : null;

  const COUNT_TONE = {
    waiting: "bg-waiting text-white dark:text-background",
    info: "bg-info/15 text-info",
  };

  return (
    <>
      <nav className="sticky top-0 z-50 h-14 w-full border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:h-16">
        <div className="mx-auto flex h-full w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            onClick={(e) => guardNavigation(e, "/")}
            className="-ml-2 flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo_dark.svg"
              alt="Guardian"
              width={1024}
              height={768}
              className="block h-[52px] w-auto dark:hidden sm:h-[60px]"
              priority
            />
            <Image
              src="/logo_white.svg"
              alt="Guardian"
              width={1024}
              height={768}
              className="hidden h-[52px] w-auto dark:block sm:h-[60px]"
              priority
            />
          </Link>

          <div className="hidden items-center gap-1 sm:flex">
            {navItems.map(({ key, label, href, count, countTone, dot }) => (
              <Link
                key={key}
                href={href}
                onClick={(e) => guardNavigation(e, href)}
                aria-current={activeKey === key ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  activeKey === key
                    ? "bg-foreground/[0.06] text-foreground dark:bg-foreground/[0.08]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
                {count !== undefined && count > 0 && countTone && (
                  <span
                    className={cn(
                      "tabular min-w-5 rounded-full px-1.5 text-center text-xs font-semibold leading-5",
                      COUNT_TONE[countTone],
                    )}
                  >
                    {count}
                  </span>
                )}
                {dot && (
                  <span
                    aria-label="Version mismatch"
                    className="size-2 rounded-full bg-blocked"
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="size-[18px]" />
              ) : (
                <Moon className="size-[18px]" />
              )}
            </Button>

            <NotificationMenu />

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 rounded-full"
                    title={getDisplayName()}
                  >
                    <Avatar className="size-8">
                      <AvatarImage
                        src={getAvatarUrl()}
                        alt={getDisplayName()}
                      />
                      <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                        {getAvatarInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="flex items-center gap-3 px-2.5 py-2">
                    <Avatar className="size-10">
                      <AvatarImage
                        src={getAvatarUrl()}
                        alt={getDisplayName()}
                      />
                      <AvatarFallback className="bg-foreground text-sm font-semibold text-background">
                        {getAvatarInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-sm font-medium">
                        {getDisplayName()}
                      </p>
                      {getDisplayEmail() && (
                        <p className="truncate text-xs text-muted-foreground">
                          {getDisplayEmail()}
                        </p>
                      )}
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setEditProfileOpen(true)}
                    className="cursor-pointer"
                  >
                    <Edit />
                    <span>Edit profile</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => void handleLogout()}
                    className="cursor-pointer text-blocked focus:text-blocked"
                  >
                    <LogOut />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      <nav
        data-tabbar
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        <div className="grid grid-cols-3">
          {navItems.map(
            ({ key, label, href, icon: Icon, count, countTone, dot }) => (
              <Link
                key={key}
                href={href}
                onClick={(e) => guardNavigation(e, href)}
                aria-current={activeKey === key ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  activeKey === key
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon
                    className="size-[22px]"
                    strokeWidth={activeKey === key ? 2.25 : 1.75}
                  />
                  {count !== undefined && count > 0 && countTone && (
                    <span
                      className={cn(
                        "tabular absolute -top-1.5 left-4 min-w-[18px] rounded-full px-1 text-center text-[11px] font-semibold leading-[18px] ring-2 ring-background",
                        countTone === "waiting"
                          ? COUNT_TONE.waiting
                          : "bg-info text-white dark:text-background",
                      )}
                    >
                      {count}
                    </span>
                  )}
                  {dot && (
                    <span
                      aria-label="Version mismatch"
                      className="absolute -top-0.5 -right-1 size-2 rounded-full bg-blocked ring-2 ring-background"
                    />
                  )}
                </span>
                {label}
              </Link>
            ),
          )}
        </div>
      </nav>

      <EditProfileModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
      />

      <Dialog
        open={showUnsavedWarning}
        onOpenChange={(open) => !open && handleCancelLeave()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-waiting" />
              Unsaved changes
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
              Stay on page
            </Button>
            <Button
              onClick={() => void handleSaveAndLeave()}
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
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
