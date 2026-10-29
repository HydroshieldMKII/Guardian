import { Button } from "@/components/ui/button";
import { ActionRow } from "@/components/ui/entity";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { SettingsCard } from "@/components/settings/settings-ui";
import { useSettingsBackup } from "@/hooks/settings/useSettingsBackup";
import { BusyLabel } from "./BusyLabel";

export function BackupCard({
  onSettingsRefresh,
}: {
  onSettingsRefresh?: () => void;
}) {
  const backup = useSettingsBackup(onSettingsRefresh);
  const { exporting, importing, mismatch } = backup;

  return (
    <>
      <SettingsCard
        title="Backup & restore"
        description="Save your settings, user preferences and policies to a file, or load them back."
      >
        <ActionRow
          title="Export settings"
          description="Download your settings, user preferences and policies as a file. Devices and session history are not included."
          action={
            <Button
              onClick={() => void backup.exportSettings()}
              disabled={exporting}
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <BusyLabel
                busy={exporting}
                label="Export settings"
                busyLabel="Exporting..."
              />
            </Button>
          }
        />

        <ActionRow
          title="Import settings"
          description="Load settings, user preferences and policies from a file you exported earlier. This overwrites what you have now."
          action={
            <>
              <input
                type="file"
                accept=".json"
                onChange={backup.chooseFile}
                disabled={importing}
                className="hidden"
                id="database-import"
              />
              <label htmlFor="database-import" className="cursor-pointer">
                <Button
                  asChild
                  disabled={importing}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <span>
                    <BusyLabel
                      busy={importing}
                      label="Import settings"
                      busyLabel="Importing..."
                    />
                  </span>
                </Button>
              </label>
            </>
          }
        />
      </SettingsCard>

      {mismatch && (
        <ConfirmationModal
          isOpen
          onClose={backup.cancelImport}
          onConfirm={backup.proceedWithImport}
          title="Exported by a different version"
          description={`The import file was created with version ${mismatch.importVersion}, but you are currently running version ${mismatch.currentVersion}. Importing data from a different version may cause compatibility issues. Do you want to proceed anyway?`}
          confirmText="Proceed with Import"
          cancelText="Cancel import"
          variant="destructive"
        />
      )}
    </>
  );
}
