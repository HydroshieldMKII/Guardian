import React, { useState } from "react";
import { StatusPill } from "@/components/ui/entity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
const NOT_MANAGEABLE_REASON =
  "PlexAmp devices cannot be managed. Plex does not provide native controls to terminate PlexAmp streams, so policies cannot be enforced for this device.";

// Not Manageable badge component with controlled tooltip for mobile support
const NotManageableBadge = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Hover and tap are the only ways in; focus must not open it
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isOpen} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex focus:outline-none rounded-md"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isMobile) {
                setIsOpen((prev) => !prev);
              }
            }}
            onMouseEnter={() => {
              if (!isMobile) setIsOpen(true);
            }}
            onMouseLeave={() => {
              if (!isMobile) setIsOpen(false);
            }}
          >
            <StatusPill tone="accent" className="cursor-help">
              Not Manageable
            </StatusPill>
            <span className="sr-only">{NOT_MANAGEABLE_REASON}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          onPointerDownOutside={(e) => {
            e.preventDefault();
            setIsOpen(false);
          }}
        >
          <p className="max-w-xs">{NOT_MANAGEABLE_REASON}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Device status component
export const DeviceStatus = ({
  device,
  compact = false,
}: {
  device: UserDevice;
  compact?: boolean;
}) => {
  const { hasTemporaryAccess, getTemporaryAccessTimeLeft } = useDeviceUtils();

  // Helper function to identify Plex Amp devices
  const isPlexAmpDevice = (device: UserDevice) => {
    return (
      device.deviceProduct?.toLowerCase().includes("plexamp") ||
      device.deviceName?.toLowerCase().includes("plexamp")
    );
  };

  // Check for temporary access first
  if (hasTemporaryAccess(device)) {
    const timeLeft = getTemporaryAccessTimeLeft(device);
    return (
      <StatusPill tone="info">
        {compact ? "Temporary Access" : `Temporary Access (${timeLeft} left)`}
      </StatusPill>
    );
  }

  // Special handling for PlexAmp devices
  if (isPlexAmpDevice(device) && device.status === "pending") {
    return <NotManageableBadge />;
  }

  switch (device.status) {
    case "approved":
      return <StatusPill tone="positive">Approved</StatusPill>;
    case "rejected":
      return <StatusPill tone="danger">Rejected</StatusPill>;
    case "pending":
    default:
      return <StatusPill tone="warning">Pending</StatusPill>;
  }
};

// User preference badge component
export const getUserPreferenceBadge = (defaultBlock: boolean | null) => {
  if (defaultBlock === null) {
    return <StatusPill tone="neutral">Global Default</StatusPill>;
  }
  if (defaultBlock) {
    return <StatusPill tone="danger">Block by Default</StatusPill>;
  }
  return <StatusPill tone="positive">Allow by Default</StatusPill>;
};
