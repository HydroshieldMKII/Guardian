import React from 'react';
import { 
  Monitor, 
  MapPin, 
  Tv, 
  Clock 
} from "lucide-react";
import { ClickableIP } from './SharedComponents';

interface StreamDeviceInfoProps {
  session: any;
}

export const StreamDeviceInfo: React.FC<StreamDeviceInfoProps> = ({ session }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground mb-2">Device Information</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Monitor className="w-3 h-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Platform</div>
            <div className="truncate">
              {session.Player?.platform || "Unknown"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Location</div>
            <div className="truncate">
              <ClickableIP
                ipAddress={session.Player?.address || null}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Tv className="w-3 h-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Product</div>
            <div className="truncate">
              {session.Player?.product && session.Player?.originalTitle 
                ? `${session.Player.product} - ${session.Player.originalTitle}`
                : session.Player?.product || "Unknown"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted p-2 rounded min-w-0">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Streams Started</div>
            <div className="truncate">
              {session.Session?.sessionCount || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};