import { cn } from "@/lib/utils";
import type { PlexSession } from "@/types";

export function StreamUserLine({
  stream,
  overArt,
  onNavigateToUser,
}: {
  stream: PlexSession;
  overArt: boolean;
  onNavigateToUser?: (userId: string) => void;
}) {
  const userId = stream.User?.id;
  const userName = stream.User?.title || "Unknown";
  const nameTone = overArt ? "text-white" : "text-foreground";

  return (
    <p
      className={cn(
        "truncate text-xs sm:text-sm",
        overArt ? "text-white/70" : "text-muted-foreground",
      )}
    >
      {userId && onNavigateToUser ? (
        <button
          type="button"
          onClick={() => onNavigateToUser(userId)}
          title="Show this user"
          className={cn(
            "cursor-pointer font-medium decoration-1 underline-offset-4 hover:underline",
            nameTone,
          )}
        >
          {userName}
        </button>
      ) : (
        <span className={cn("font-medium", nameTone)}>{userName}</span>
      )}
      {stream.Player?.title && <> on {stream.Player.title}</>}
    </p>
  );
}
