"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  isAdminUser,
  isPlexUser,
  useAuth,
  type User,
} from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";

const displayNameOf = (user: User | null) => {
  if (isPlexUser(user)) return user.plexUsername;
  if (isAdminUser(user)) return user.username;
  return "User";
};

const avatarOf = (user: User | null) => {
  if (isPlexUser(user)) return user.plexThumb;
  if (isAdminUser(user)) return user.avatarUrl || user.plexThumb;
  return null;
};

export function PortalHeader({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const avatar = avatarOf(user);
  const displayName = displayNameOf(user);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 h-14 w-full border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:h-16">
      <div className="mx-auto flex h-full w-full max-w-3xl items-center gap-2 px-4 sm:px-6">
        <span className="-ml-2 flex shrink-0 items-center">
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
        </span>

        <div className="ml-auto flex items-center gap-1">
          <RefreshButton
            variant="ghost"
            refreshing={refreshing}
            onRefresh={onRefresh}
            className="size-9 text-muted-foreground hover:text-foreground"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-9 text-muted-foreground hover:text-foreground"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
          <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-8 shrink-0">
              {avatar && <AvatarImage src={avatar} alt={displayName} />}
              <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[160px] truncate text-sm font-medium text-foreground sm:block">
              {displayName}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            className="ml-1 text-muted-foreground hover:text-foreground"
            title="Logout"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
