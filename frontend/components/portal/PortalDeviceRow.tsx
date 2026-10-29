import { Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/entity";
import { DeviceIcon } from "@/components/portal/DeviceIcon";
import { PortalStatusBadge } from "@/components/portal/PortalStatusBadge";
import { ScheduleList } from "@/components/portal/ScheduleList";
import { sentNote, type PortalNote } from "@/lib/portal";
import { cn } from "@/lib/utils";
import type { PortalDevice } from "@/types";

function SentNote({ note }: { note: PortalNote }) {
  return (
    <div
      className={cn(
        "mt-3 rounded-lg px-3 py-2.5 sm:ml-14",
        note.readAt ? "bg-allowed/8" : "bg-muted/70",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageSquare className="size-3.5" />
          Your note to the server owner
        </p>
        <StatusPill size="sm" tone={note.readAt ? "positive" : "neutral"}>
          {note.readAt ? "Read" : "Not read yet"}
        </StatusPill>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">
        {note.description}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>Submitted {new Date(note.submittedAt).toLocaleString()}</span>
        {note.readAt && (
          <span className="text-allowed">
            Read on {new Date(note.readAt).toLocaleString()}
          </span>
        )}
      </p>
    </div>
  );
}

export function PortalDeviceRow({
  device,
  canAddNote,
  onAddNote,
}: {
  device: PortalDevice;
  canAddNote: boolean;
  onAddNote: (device: PortalDevice) => void;
}) {
  const note = sentNote(device);
  const timeRules = device.rules?.timeRules ?? [];

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <DeviceIcon platform={device.devicePlatform} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <p className="truncate text-sm font-medium text-foreground sm:text-base">
              {device.deviceName}
            </p>
            <PortalStatusBadge device={device} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
            {device.deviceProduct} · {device.devicePlatform}
          </p>
        </div>
        {canAddNote && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddNote(device)}
            className="shrink-0"
          >
            <MessageSquare />
            Add note
          </Button>
        )}
      </div>

      {note && <SentNote note={note} />}

      {timeRules.length > 0 && (
        <div className="mt-3 space-y-2 sm:ml-14">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" />
            Schedule for this device
          </p>
          <ScheduleList rules={timeRules} />
        </div>
      )}
    </li>
  );
}
