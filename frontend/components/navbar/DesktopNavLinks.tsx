import Link from "next/link";
import { cn } from "@/lib/utils";
import { badgeCount, COUNT_TONE, type NavItem } from "./nav-items";
import type { NavLinksProps } from "./types";

const STACKED = "col-start-1 row-start-1";
const PILL =
  "tabular min-w-5 rounded-full px-1.5 text-center text-xs font-semibold leading-5";

function WidthReserve({ item }: { item: NavItem }) {
  return (
    <span
      aria-hidden
      data-width-reserve
      className={cn(STACKED, "invisible inline-flex items-center gap-2")}
    >
      <span
        data-label={item.label}
        className="before:content-[attr(data-label)]"
      />
      <span className={cn(PILL, "before:content-['99']")} />
    </span>
  );
}

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
              "relative inline-grid h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
              activeKey === item.key
                ? "bg-foreground/[0.06] text-foreground dark:bg-foreground/[0.08]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.countTone && <WidthReserve item={item} />}
            <span
              className={cn(
                STACKED,
                "inline-flex items-center justify-center gap-2",
              )}
            >
              {item.label}
              {count !== null && item.countTone && (
                <span className={cn(PILL, COUNT_TONE[item.countTone])}>
                  {count}
                </span>
              )}
              {item.dot && (
                <span
                  aria-label="Version mismatch"
                  className="size-2 rounded-full bg-blocked"
                />
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
