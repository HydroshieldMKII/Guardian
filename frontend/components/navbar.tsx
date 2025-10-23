"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useVersion } from "@/contexts/version-context";
import { NotificationMenu } from "@/components/notification-menu";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { versionInfo } = useVersion();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between w-full px-4">
        <Link href="/" className="flex items-center space-x-2 pl-10">
          <div className="flex items-center">
            {/* Light theme logo (dark logo) */}
            <Image
              src="/logo_dark.svg"
              alt="Guardian"
              width={300}
              height={48}
              className="block dark:hidden"
              style={{ height: "80px", width: "auto" }}
              priority
            />
            {/* Dark theme logo (light logo) */}
            <Image
              src="/logo_white.svg"
              alt="Guardian"
              width={300}
              height={48}
              className="hidden dark:block"
              style={{ height: "80px", width: "auto" }}
              priority
            />
          </div>
        </Link>

        {/* Right side with theme toggle, notifications, and settings */}
        <div className="flex items-center space-x-2 pr-10">
          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-full"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Notification Menu */}
          <NotificationMenu />

          {/* Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 rounded-full"
            title="Settings"
          >
            <Link href="/settings" className="flex items-center justify-center">
              <Settings className="h-4 w-4" />
              {versionInfo?.isVersionMismatch && (
                <div className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
              )}
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
