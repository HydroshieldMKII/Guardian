import { Edit, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./UserAvatar";
import type { UserIdentity } from "./user-identity";

export function UserMenu({
  identity,
  onEditProfile,
  onLogout,
}: {
  identity: UserIdentity;
  onEditProfile: () => void;
  onLogout: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 rounded-full"
          title={identity.name}
        >
          <UserAvatar
            identity={identity}
            className="size-8"
            fallbackClassName="text-xs"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <UserAvatar
            identity={identity}
            className="size-10"
            fallbackClassName="text-sm"
          />
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-sm font-medium">{identity.name}</p>
            {identity.email && (
              <p className="truncate text-xs text-muted-foreground">
                {identity.email}
              </p>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onEditProfile} className="cursor-pointer">
          <Edit />
          <span>Edit profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer text-blocked focus:text-blocked"
        >
          <LogOut />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
