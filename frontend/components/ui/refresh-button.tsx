"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const REFRESH_DONE_MS = 1500;

export function RefreshButton({
  refreshing,
  onRefresh,
  disabled,
  variant = "outline",
  className,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  disabled?: boolean;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const requested = useRef(false);
  const wasRefreshing = useRef(refreshing);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const finished = wasRefreshing.current && !refreshing;
    wasRefreshing.current = refreshing;
    if (refreshing) setDone(false);
    if (!finished || !requested.current) return;
    requested.current = false;
    setDone(true);
    const timer = setTimeout(() => setDone(false), REFRESH_DONE_MS);
    return () => clearTimeout(timer);
  }, [refreshing]);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          requested.current = true;
          setDone(false);
          onRefresh();
        }}
        disabled={disabled || refreshing}
        title="Refresh"
        className={cn("size-10 shrink-0 px-0", className)}
      >
        <span
          key={done ? "done" : "idle"}
          className="flex animate-in fade-in zoom-in-75 duration-200 motion-reduce:animate-none"
        >
          {done ? (
            <Check data-testid="refresh-done" className="size-4 text-allowed" />
          ) : (
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          )}
        </span>
        <span className="sr-only">Refresh</span>
      </Button>
      <span role="status" className="sr-only">
        {done ? "Refreshed" : ""}
      </span>
    </>
  );
}
