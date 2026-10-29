import Link from "next/link";
import { cn } from "@/lib/utils";
import { badgeCount, COUNT_TONE } from "./nav-items";
import type { NavLinksProps } from "./types";

export function DesktopNavLinks({
  items,
  activeKey,
  onNavigate,
}: NavLinksProps) {
  return (
    <div className="hidden items-center gap-1 sm:flex">
      {items.map((item) => {
        const count = badgeCount(item);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={(e) => onNavigate(e, item.href)}
            aria-current={activeKey === item.key ? "page" : undefined}
            className={cn(
              "relative inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              activeKey === item.key
                ? "bg-foreground/[0.06] text-foreground dark:bg-foreground/[0.08]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
            {count !== null && item.countTone && (
              <span
                className={cn(
                  "tabular min-w-5 rounded-full px-1.5 text-center text-xs font-semibold leading-5",
                  COUNT_TONE[item.countTone],
                )}
              >
                {count}
              </span>
            )}
            {item.dot && (
              <span
                aria-label="Version mismatch"
                className="size-2 rounded-full bg-blocked"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
