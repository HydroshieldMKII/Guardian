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
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
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

          {/* Right side with theme toggle, notifications, and settings */}
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
          </div>
        </div>
      </div>
    </nav>
  );
}
