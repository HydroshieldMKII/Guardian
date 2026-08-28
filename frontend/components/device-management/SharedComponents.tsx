import React from "react";
import { StatusPill } from "@/components/ui/entity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserDevice } from "@/types";
import { isPlexampDevice } from "@/lib/device-policies";

export { ClickableIP } from "@/components/ui/clickable-ip";

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
    <Avatar className="h-10 w-10 flex-shrink-0">
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          className="object-cover"
        />
      )}
      <AvatarFallback className="bg-muted text-xs text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

export const NOT_MANAGEABLE_REASON =
  "Plexamp devices cannot be managed. Plex provides no way to terminate a Plexamp stream, so no policy can be enforced against this device.";

const NotManageableBadge = () => (
  <StatusPill tone="accent" hint={NOT_MANAGEABLE_REASON}>
    Not Manageable
  </StatusPill>
);

export const DeviceStatus = ({ device }: { device: UserDevice }) => {
  if (isPlexampDevice(device) && device.status === "pending") {
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

export const getUserPreferenceBadge = (defaultBlock: boolean | null) => {
  if (defaultBlock === null) {
    return <StatusPill tone="neutral">Global Default</StatusPill>;
  }
  if (defaultBlock) {
    return <StatusPill tone="danger">Block by Default</StatusPill>;
  }
  return <StatusPill tone="positive">Allow by Default</StatusPill>;
};
