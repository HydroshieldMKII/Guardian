import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Chip,
  EmptyState,
  Field,
  Panel,
  PillRow,
} from "@/components/ui/entity";
import type { IPAccessForm } from "@/hooks/device-management/useIPAccessForm";

interface AllowedIPsPanelProps {
  form: IPAccessForm;
  onAddCurrentAddresses?: () => void;
}

export function AllowedIPsPanel({
  form,
  onAddCurrentAddresses,
}: AllowedIPsPanelProps) {
  const { allowedIPs } = form;

  return (
    <Panel className="space-y-4">
      <Field
        label="Allowed IP addresses"
        htmlFor="new-ip"
        action={
          onAddCurrentAddresses ? (
            <Button variant="outline" size="sm" onClick={onAddCurrentAddresses}>
              Add current device addresses
            </Button>
          ) : undefined
        }
      >
        <div className="flex gap-2">
          <Input
            id="new-ip"
            placeholder="192.168.1.100, 192.168.1.0/24 or 2001:db8::/32"
            value={form.newIP}
            onChange={(event) => form.changeNewIP(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && form.addIP()}
            aria-invalid={Boolean(form.ipError)}
            className="flex-1"
          />
          <Button onClick={form.addIP} variant="outline">
            Add
          </Button>
        </div>
      </Field>

      {form.ipError && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          {form.ipError}
        </p>
      )}

      {allowedIPs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {allowedIPs.length} address
            {allowedIPs.length === 1 ? "" : "es"} allowed
          </p>
          <PillRow>
            {allowedIPs.map((ip, index) => (
              <Chip
                key={ip}
                onRemove={() => form.removeIP(index)}
                removeLabel={`Remove ${ip}`}
              >
                {ip}
              </Chip>
            ))}
          </PillRow>
        </div>
      )}

      {form.noIPsConfigured && (
        <EmptyState
          className="border-amber-500/30 bg-amber-500/5"
          title="No addresses allowed yet"
          description="Add at least one address. While this list is empty every stream from this user is blocked."
        />
      )}
    </Panel>
  );
}
