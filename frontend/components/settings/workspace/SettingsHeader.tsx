import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/entity";
import { useVersionInfo } from "@/hooks/useVersionInfo";

interface SettingsHeaderProps {
  onShowSystem: () => void;
  onBack: () => void;
}

export function SettingsHeader({ onShowSystem, onBack }: SettingsHeaderProps) {
  const { versionInfo } = useVersionInfo();

  return (
    <header className="mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Settings
        </h1>
        {versionInfo && (
          <button
            type="button"
            onClick={onShowSystem}
            title="View system information"
            className="cursor-pointer rounded-full transition-opacity hover:opacity-80"
          >
            <StatusPill tone="neutral">v{versionInfo.version}</StatusPill>
          </button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
        >
          Back to Dashboard
        </Button>
      </div>
    </header>
  );
}
