import type { ReactNode } from "react";

export function DetailGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="divide-y divide-border/70 rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
        {children}
      </div>
    </section>
  );
}
