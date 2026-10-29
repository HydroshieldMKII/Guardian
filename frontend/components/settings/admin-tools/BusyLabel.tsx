import { Loader2 } from "lucide-react";

export function BusyLabel({
  busy,
  label,
  busyLabel,
}: {
  busy: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <>
      {busy && <Loader2 className="size-4 animate-spin" />}
      {busy ? busyLabel : label}
    </>
  );
}
