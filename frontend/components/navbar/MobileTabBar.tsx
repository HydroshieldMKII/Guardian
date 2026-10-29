import Link from "next/link";
import { cn } from "@/lib/utils";
import { badgeCount, COUNT_TONE, type CountTone } from "./nav-items";
import type { NavLinksProps } from "./types";

const MOBILE_COUNT_TONE: Record<CountTone, string> = {
  waiting: COUNT_TONE.waiting,
  info: "bg-info text-white dark:text-background",
};

export function MobileTabBar({ items, activeKey, onNavigate }: NavLinksProps) {
  return (
    <nav
      data-tabbar
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <div className="grid grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeKey === item.key;
          const count = badgeCount(item);
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={(e) => onNavigate(e, item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon
                  className="size-[22px]"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {count !== null && item.countTone && (
                  <span
                    className={cn(
                      "tabular absolute -top-1.5 left-4 min-w-[18px] rounded-full px-1 text-center text-[11px] font-semibold leading-[18px] ring-2 ring-background",
                      MOBILE_COUNT_TONE[item.countTone],
                    )}
                  >
                    {count}
                  </span>
                )}
                {item.dot && (
                  <span
                    aria-label="Version mismatch"
                    className="absolute -top-0.5 -right-1 size-2 rounded-full bg-blocked ring-2 ring-background"
                  />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
