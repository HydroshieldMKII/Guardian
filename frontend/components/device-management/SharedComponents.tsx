import React, { useState } from "react";
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
  HelpCircle,
} from "lucide-react";
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
      "noopener,noreferrer"
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
  product: string | null | undefined
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

  // Handle open change - only allow Radix to control on desktop
  const handleOpenChange = (open: boolean) => {
    if (!isMobile) {
      setIsOpen(open);
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
            <Badge
              variant="secondary"
              className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700 cursor-help"
            >
              <HelpCircle className="w-3 h-3 mr-1" />
              Not Manageable
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent
          onPointerDownOutside={(e) => {
            e.preventDefault();
            setIsOpen(false);
          }}
        >
          <p className="max-w-xs">
            PlexAmp devices cannot be managed. Plex does not provide native
            controls to terminate PlexAmp streams, so policies cannot be
            enforced for this device.
          </p>
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
      <div className="flex items-center gap-2">
        <Badge
          variant="default"
          className="bg-blue-600 dark:bg-blue-700 text-white"
        >
          <Timer className="w-3 h-3 mr-1" />
          {compact ? "Temporary Access" : `Temporary Access (${timeLeft} left)`}
        </Badge>
      </div>
    );
  }

  // Special handling for PlexAmp devices
  if (isPlexAmpDevice(device) && device.status === "pending") {
    return <NotManageableBadge />;
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
