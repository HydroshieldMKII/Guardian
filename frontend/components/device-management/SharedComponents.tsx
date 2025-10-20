import React from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Timer,
  Smartphone,
  Tv,
  Laptop,
  Monitor,
  ExternalLink,
} from "lucide-react";
import { UserDevice, UserPreference } from "@/types";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";

// Clickable IP component
export const ClickableIP = ({
  ipAddress,
}: {
  ipAddress: string | null | undefined;
}) => {
  if (!ipAddress || ipAddress === "Unknown IP" || ipAddress === "Unknown") {
    return <span className="truncate">{ipAddress || "Unknown IP"}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click events
    window.open(
      `https://ipinfo.io/${ipAddress}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <button
      onClick={handleClick}
      className="truncate text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors"
      title={`Look up ${ipAddress} on ipinfo.io`}
    >
      <span className="truncate">{ipAddress}</span>
      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
    </button>
  );
};

// User avatar component that displays Plex profile picture
export const UserAvatar = ({
  userId,
  username,
  avatarUrl,
}: {
  userId: string;
  username?: string;
  avatarUrl?: string;
}) => {
  const displayName = username || userId;
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <Avatar className="w-10 h-10 flex-shrink-0">
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          className="object-cover"
        />
      )}
      <AvatarFallback className="text-xs bg-muted text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

// Device icon component
export const getDeviceIcon = (
  platform: string | null | undefined,
  product: string | null | undefined,
) => {
  const p = platform?.toLowerCase() || product?.toLowerCase() || "";

  if (
    p.includes("android") ||
    p.includes("iphone") ||
    p.includes("ios") ||
    p.includes("mobile")
  ) {
    return <Smartphone className="w-4 h-4" />;
  }
  if (
    p.includes("tv") ||
    p.includes("roku") ||
    p.includes("apple tv") ||
    p.includes("chromecast")
  ) {
    return <Tv className="w-4 h-4" />;
  }
  if (p.includes("windows") || p.includes("mac") || p.includes("linux")) {
    return <Laptop className="w-4 h-4" />;
  }
  return <Monitor className="w-4 h-4" />;
};

// Device status component
export const DeviceStatus = ({ device }: { device: UserDevice }) => {
  const { hasTemporaryAccess, getTemporaryAccessTimeLeft } = useDeviceUtils();

  // Check for temporary access first
  if (hasTemporaryAccess(device)) {
    const timeLeft = getTemporaryAccessTimeLeft(device);
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="default"
          className="bg-blue-600 dark:bg-blue-700 text-white"
        >
          <Timer className="w-3 h-3 mr-1" />
          Temporary Access ({timeLeft} left)
        </Badge>
      </div>
    );
  }

  switch (device.status) {
    case "approved":
      return (
        <Badge
          variant="default"
          className="bg-green-600 dark:bg-green-700 text-white"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          variant="destructive"
          className="bg-red-600 dark:bg-red-700 text-white"
        >
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700"
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

// User preference badge component
export const getUserPreferenceBadge = (defaultBlock: boolean | null) => {
  if (defaultBlock === null) {
    return (
      <Badge variant="secondary">
        <Settings className="w-3 h-3 mr-1" />
        Global Default
      </Badge>
    );
  }
  if (defaultBlock) {
    return (
      <Badge
        variant="destructive"
        className="bg-red-600 dark:bg-red-700 text-white"
      >
        <XCircle className="w-3 h-3 mr-1" />
        Block by Default
      </Badge>
    );
  }
  return (
    <Badge
      variant="default"
      className="bg-green-600 dark:bg-green-700 text-white"
    >
      <CheckCircle className="w-3 h-3 mr-1" />
      Allow by Default
    </Badge>
  );
};
