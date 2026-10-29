"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { useAuth } from "@/contexts/auth-context";
import { NotificationMenu } from "@/components/notification-menu";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { useDashboardQuery } from "@/hooks/useDashboardQuery";
import { useLogout } from "@/hooks/navbar/useLogout";
import { useNavigationGuard } from "@/hooks/navbar/useNavigationGuard";
import { AUTH_ROUTES } from "@/lib/auth/return-to";
import { dashboardCounts, resolveDashboardView } from "@/lib/dashboard-view";
import { DesktopNavLinks } from "./navbar/DesktopNavLinks";
import { MobileTabBar } from "./navbar/MobileTabBar";
import { navItems, type NavKey } from "./navbar/nav-items";
import { NavbarLogo } from "./navbar/NavbarLogo";
import { ThemeToggle } from "./navbar/ThemeToggle";
import { UnsavedChangesDialog } from "./navbar/UnsavedChangesDialog";
import { userIdentity } from "./navbar/user-identity";
import { UserMenu } from "./navbar/UserMenu";

export function Navbar() {
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const { versionInfo } = useVersionInfo();
  const { user, userType, setupRequired, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigation = useNavigationGuard(pathname);
  const logout = useLogout();

  const hidden =
    setupRequired ||
    !isAuthenticated ||
    AUTH_ROUTES.includes(pathname) ||
    userType === "plex_user";
  const { data: dashboardData } = useDashboardQuery(
    !hidden && pathname !== "/",
  );

  if (hidden) {
    return null;
  }

  const items = navItems({
    ...dashboardCounts(dashboardData),
    versionMismatch: Boolean(versionInfo?.isVersionMismatch),
    plexConfigured: dashboardData?.plexStatus.configured !== false,
  });
  const activeKey: NavKey | null =
    pathname === "/settings"
      ? "settings"
      : pathname === "/"
        ? resolveDashboardView(searchParams.get("view"), dashboardData)
        : null;

  return (
    <>
      <nav className="sticky top-0 z-50 h-14 w-full border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:h-16">
        <div className="mx-auto flex h-full w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <NavbarLogo onNavigate={navigation.guard} />
          <DesktopNavLinks
            items={items}
            activeKey={activeKey}
            onNavigate={navigation.guard}
          />

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationMenu />
            {user && (
              <UserMenu
                identity={userIdentity(user)}
                onEditProfile={() => setEditProfileOpen(true)}
                onLogout={() => void logout()}
              />
            )}
          </div>
        </div>
      </nav>

      {items.length > 1 && (
        <MobileTabBar
          items={items}
          activeKey={activeKey}
          onNavigate={navigation.guard}
        />
      )}

      <EditProfileModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
      />

      <UnsavedChangesDialog
        open={navigation.warningOpen}
        isSaving={navigation.isSaving}
        saveBlocked={navigation.saveBlocked}
        onStay={navigation.stay}
        onSave={() => void navigation.saveAndLeave()}
        onDiscard={navigation.discard}
      />
    </>
  );
}
