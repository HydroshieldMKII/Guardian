import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserIdentity } from "./user-identity";

export function UserAvatar({
  identity,
  className,
  fallbackClassName,
}: {
  identity: UserIdentity;
  className: string;
  fallbackClassName: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={identity.avatarUrl} alt={identity.name} />
      <AvatarFallback
        className={cn(
          "bg-foreground font-semibold text-background",
          fallbackClassName,
        )}
      >
        {identity.initials}
      </AvatarFallback>
    </Avatar>
  );
}
