import React from "react";
import { Monitor, MapPin, Tv, Clock } from "lucide-react";
import { ClickableIP } from "./SharedComponents";

interface StreamDeviceInfoProps {
  session: any;
}

export const StreamDeviceInfo: React.FC<StreamDeviceInfoProps> = ({
  session,
}) => {
  return (
    <div className="space-y-2 bg-muted/30 dark:bg-muted/20 p-3 rounded-md border border-border/50">
      <h4 className="text-sm font-semibold text-foreground/90 dark:text-foreground mb-2">
        Device Information
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Monitor className="w-3 h-3 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">
              Platform
            </div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">
              {session.Player?.platform || "Unknown"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <MapPin className="w-3 h-3 flex-shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">
              Location
            </div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">
              <ClickableIP ipAddress={session.Player?.address || null} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Tv className="w-3 h-3 flex-shrink-0 text-purple-600 dark:text-purple-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">
              Product
            </div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">
              {session.Player?.product && session.Player?.originalTitle
                ? `${session.Player.product} - ${session.Player.originalTitle}`
                : session.Player?.product || "Unknown"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border/30 min-w-0">
          <Clock className="w-3 h-3 flex-shrink-0 text-orange-600 dark:text-orange-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground/80 dark:text-foreground/70">
              Streams Started
            </div>
            <div className="truncate text-foreground/60 dark:text-foreground/50 font-medium">
              {session.Session?.sessionCount || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
