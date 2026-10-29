import { Button } from "@/components/ui/button";

export function MissingUserNotice({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <p className="text-[15px] font-semibold text-foreground">
        This user is not in the list
      </p>
      <p className="text-sm text-muted-foreground">
        They may be hidden or no longer have any devices.
      </p>
      <Button variant="outline" size="sm" onClick={onBack}>
        Back to all users
      </Button>
    </div>
  );
}
