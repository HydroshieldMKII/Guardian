import React from "react";
import { Button } from "@/components/ui/button";
import {
  ActionBar,
  EntityCard,
  EntityHeader,
  Meta,
  MetaGrid,
  StatusPill,
} from "@/components/ui/entity";
import {
  formatDateTime,
  sessionDeviceName,
  sessionDuration,
  sessionProduct,
  sessionSubtitle,
  sessionTitle,
  sessionTone,
  type SessionHistoryEntry,
} from "@/lib/session-history";
import { ClickableIP } from "./SharedComponents";

const SessionStatus = ({ session }: { session: SessionHistoryEntry }) => {
  if (!session.endedAt) return <StatusPill tone="positive">Active</StatusPill>;
  if (session.terminated) {
    return <StatusPill tone="danger">Terminated</StatusPill>;
  }
  return <StatusPill tone="neutral">Ended</StatusPill>;
};

export function SessionHistoryCard({
  session,
  onSeeDevice,
  onDelete,
}: {
  session: SessionHistoryEntry;
  onSeeDevice: () => void;
  onDelete: () => void;
}) {
  return (
    <EntityCard data-session-id={session.id} tone={sessionTone(session)}>
      <div className="space-y-3 p-4 pl-5 sm:space-y-4">
        <EntityHeader
          title={sessionTitle(session)}
          subtitle={sessionSubtitle(session) || undefined}
          status={<SessionStatus session={session} />}
        />

        <MetaGrid className="gap-y-3 sm:grid-cols-3 sm:gap-y-4 lg:grid-cols-4">
          <Meta label="Device">{sessionDeviceName(session)}</Meta>
          <Meta label="Platform">
            {session.userDevice?.devicePlatform || "Unknown"}
          </Meta>
          <Meta label="Product">{sessionProduct(session)}</Meta>
          <Meta label="IP address">
            <ClickableIP ipAddress={session.deviceAddress} />
          </Meta>
          <Meta label="Started">{formatDateTime(session.startedAt)}</Meta>
          <Meta label="Ended">
            {session.endedAt ? formatDateTime(session.endedAt) : "Active"}
          </Meta>
          <Meta label="Duration" wrap className="tabular-nums">
            {sessionDuration(session)}
          </Meta>
        </MetaGrid>

        <ActionBar>
          <Button
            variant="outline"
            size="sm"
            onClick={onSeeDevice}
            title="Go to this device"
            className="h-10 flex-1 sm:h-8 sm:flex-none"
          >
            See device
          </Button>
          {session.endedAt && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              title="Delete this entry"
              className="h-10 flex-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 sm:ml-auto sm:h-8 sm:flex-none"
            >
              Delete
            </Button>
          )}
        </ActionBar>
      </div>
    </EntityCard>
  );
}
