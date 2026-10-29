import type { ReactNode } from "react";
import { Chip, PillRow, StatusPill } from "@/components/ui/entity";
import { ScheduleList } from "@/components/portal/ScheduleList";
import {
  networkPolicyLabel,
  restrictedIPs,
  streamLimitLabel,
} from "@/lib/portal";
import type { PortalUserRules } from "@/types";

function RuleItem({
  title,
  description,
  value,
  children,
}: {
  title: string;
  description: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {value && <div className="shrink-0">{value}</div>}
      </div>
      {children}
    </div>
  );
}

export function PortalRules({ rules }: { rules: PortalUserRules }) {
  const allowedIPs = restrictedIPs(rules);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Your rules
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What the server owner allows on your account
        </p>
      </div>

      <div className="divide-y divide-border/70 rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
        <RuleItem
          title="Network access"
          description="Where you are allowed to stream from"
          value={
            <StatusPill>{networkPolicyLabel(rules.networkPolicy)}</StatusPill>
          }
        />
        <RuleItem
          title="IP addresses"
          description={
            allowedIPs.length > 0
              ? "You can only stream from these addresses"
              : "Which addresses you can stream from"
          }
          value={
            <StatusPill>
              {rules.ipAccessPolicy === "all"
                ? "Any address"
                : "Only listed addresses"}
            </StatusPill>
          }
        >
          {allowedIPs.length > 0 && (
            <PillRow>
              {allowedIPs.map((ip) => (
                <Chip key={ip}>{ip}</Chip>
              ))}
            </PillRow>
          )}
        </RuleItem>
        <RuleItem
          title="New devices"
          description="How new devices are handled when they first connect"
          value={
            <StatusPill
              dot
              tone={rules.effectiveDefaultBlock ? "danger" : "positive"}
            >
              {rules.effectiveDefaultBlock
                ? "Blocked until approved"
                : "Allowed straight away"}
            </StatusPill>
          }
        />
        <RuleItem
          title="Streams at once"
          description="How many devices can stream at the same time"
          value={
            <StatusPill>
              {streamLimitLabel(rules.effectiveConcurrentStreamLimit)}
            </StatusPill>
          }
        />
        {rules.timeRules.length > 0 && (
          <RuleItem
            title="Time schedule"
            description="The hours you cannot stream, on any of your devices"
          >
            <ScheduleList rules={rules.timeRules} />
          </RuleItem>
        )}
      </div>
    </section>
  );
}
