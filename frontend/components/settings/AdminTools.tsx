"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toneButton } from "@/components/ui/entity";
import { ActionRow, SettingsCard } from "./settings-ui";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { PasswordConfirmationModal } from "@/components/ui/password-confirmation-modal";
import { useVersion } from "@/contexts/version-context";
import { VersionMismatchInfo } from "./settings-utils";

interface AdminToolsProps {
  onSettingsRefresh?: () => void;
}

export function AdminTools({ onSettingsRefresh }: AdminToolsProps) {
  const { toast } = useToast();
  const { versionInfo } = useVersion();

  // State for various operations
  const [resettingStreamCounts, setResettingStreamCounts] = useState(false);
  const [clearingSessionHistory, setClearingSessionHistory] = useState(false);
  const [deletingAllDevices, setDeletingAllDevices] = useState(false);
  const [resettingDatabase, setResettingDatabase] = useState(false);
  const [exportingDatabase, setExportingDatabase] = useState(false);
  const [importingDatabase, setImportingDatabase] = useState(false);

  // Modal states
  const [showResetStreamCountsModal, setShowResetStreamCountsModal] =
    useState(false);
  const [showClearSessionHistoryModal, setShowClearSessionHistoryModal] =
    useState(false);
  const [showDeleteAllDevicesModal, setShowDeleteAllDevicesModal] =
    useState(false);
  const [showResetDatabaseModal, setShowResetDatabaseModal] = useState(false);

  // Password confirmation modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type:
      | "resetStreamCounts"
      | "clearSessionHistory"
      | "deleteAllDevices"
      | "resetDatabase";
    title: string;
    description: string;
    isDangerous?: boolean;
  } | null>(null);
  const [showVersionMismatchModal, setShowVersionMismatchModal] =
    useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [versionMismatchInfo, setVersionMismatchInfo] =
    useState<VersionMismatchInfo | null>(null);

  // Check for post-reload success messages
  useEffect(() => {
    const resetSuccess = localStorage.getItem("guardianResetSuccess");
    if (resetSuccess) {
      localStorage.removeItem("guardianResetSuccess");
      toast({
        title: "Factory Reset Complete",
        description: "Everything is back to its default settings.",
        variant: "success",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetStreamCounts = async (password?: string) => {
    if (typeof password !== "string" || password === "") {
      setPendingAction({
        type: "resetStreamCounts",
        title: "Reset Stream Counts",
        description:
          "Enter your password to reset every device's stream count.",
        isDangerous: false,
      });
      setShowPasswordModal(true);
      setShowResetStreamCountsModal(false);
      return;
    }

    try {
      setResettingStreamCounts(true);
      await apiClient.resetStreamCounts(password);

      toast({
        title: "Stream Counts Reset",
        description: "Every device's stream count is back to zero.",
        variant: "success",
      });
      setShowPasswordModal(false);
      setPendingAction(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to reset stream counts",
        variant: "destructive",
      });
    } finally {
      setResettingStreamCounts(false);
      setShowResetStreamCountsModal(false);
    }
  };

  const handleClearSessionHistory = async (password?: string) => {
    if (typeof password !== "string" || password === "") {
      setPendingAction({
        type: "clearSessionHistory",
        title: "Clear Session History",
        description:
          "Enter your password to permanently delete every session history record.",
        isDangerous: true,
      });
      setShowPasswordModal(true);
      setShowClearSessionHistoryModal(false);
      return;
    }

    try {
      setClearingSessionHistory(true);
      await apiClient.clearSessionHistory(password);

      toast({
        title: "Session History Cleared",
        description: "Every session history record has been deleted.",
        variant: "success",
      });
      setShowPasswordModal(false);
      setPendingAction(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to clear session history",
        variant: "destructive",
      });
    } finally {
      setClearingSessionHistory(false);
      setShowClearSessionHistoryModal(false);
    }
  };

  const handleDeleteAllDevices = async (password?: string) => {
    if (typeof password !== "string" || password === "") {
      setPendingAction({
        type: "deleteAllDevices",
        title: "Delete All Devices",
        description:
          "Enter your password to permanently delete every device. Each one has to be approved again the next time it connects.",
        isDangerous: true,
      });
      setShowPasswordModal(true);
      setShowDeleteAllDevicesModal(false);
      return;
    }

    try {
      setDeletingAllDevices(true);
      await apiClient.deleteAllDevices(password);

      toast({
        title: "All Devices Deleted",
        description:
          "Every device is gone. They reappear as pending the next time they connect.",
        variant: "success",
      });
      onSettingsRefresh?.();
      setShowPasswordModal(false);
      setPendingAction(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete all devices",
        variant: "destructive",
      });
    } finally {
      setDeletingAllDevices(false);
      setShowDeleteAllDevicesModal(false);
    }
  };

  const handleResetDatabase = async (password?: string) => {
    if (typeof password !== "string" || password === "") {
      setPendingAction({
        type: "resetDatabase",
        title: "Factory Reset",
        description:
          "Enter your password to erase all of your data and restore the default settings.",
        isDangerous: true,
      });
      setShowPasswordModal(true);
      setShowResetDatabaseModal(false);
      return;
    }

    try {
      setResettingDatabase(true);
      await apiClient.resetDatabase(password);

      toast({
        title: "Success",
        description: "Database has been reset successfully. Page will reload.",
        variant: "success",
      });
      onSettingsRefresh?.();
      setShowPasswordModal(false);
      setPendingAction(null);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reset database",
        variant: "destructive",
      });
      // Don't close password modal on error - let user try again
    } finally {
      setResettingDatabase(false);
      setShowResetDatabaseModal(false);
    }
  };

  const handlePasswordConfirmation = async (password: string) => {
    if (!pendingAction) return;

    switch (pendingAction.type) {
      case "resetStreamCounts":
        await handleResetStreamCounts(password);
        break;
      case "clearSessionHistory":
        await handleClearSessionHistory(password);
        break;
      case "deleteAllDevices":
        await handleDeleteAllDevices(password);
        break;
      case "resetDatabase":
        await handleResetDatabase(password);
        break;
    }
  };

  const exportDatabase = async () => {
    try {
      setExportingDatabase(true);
      const data = await apiClient.exportDatabase();

      // Convert the data to a blob for download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guardian-settings-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Settings Exported",
        description:
          "Your settings, user preferences and policies were downloaded",
        variant: "success",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export your settings",
        variant: "destructive",
      });
    } finally {
      setExportingDatabase(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        // Check for version mismatch
        if (importData.version && versionInfo?.version) {
          const importVersion = importData.version;
          const currentVersion = versionInfo.version;

          if (importVersion !== currentVersion) {
            setVersionMismatchInfo({
              currentVersion,
              importVersion,
            });
            setPendingImportFile(file);
            setShowVersionMismatchModal(true);
            return;
          }
        }

        // No version mismatch, proceed with import
        importDatabase(file);
      } catch (error) {
        toast({
          title: "Invalid File",
          description: "Choose an exported .json settings file",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const importDatabase = async (file: File) => {
    try {
      setImportingDatabase(true);

      const formData = new FormData();
      formData.append("file", file);

      await apiClient.importDatabase(formData);

      toast({
        title: "Settings Imported",
        description: "Applying new settings...",
        variant: "success",
      });

      onSettingsRefresh?.();

      // Set flag for post-reload toast
      setTimeout(() => {
        localStorage.setItem("guardianResetSuccess", "true");
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description:
          error instanceof Error ? error.message : "Failed to import settings",
        variant: "destructive",
      });
    } finally {
      setImportingDatabase(false);
      setPendingImportFile(null);
    }
  };

  const handleProceedWithImport = () => {
    if (pendingImportFile) {
      setShowVersionMismatchModal(false);
      importDatabase(pendingImportFile);
    }
  };

  const handleCancelImport = () => {
    setShowVersionMismatchModal(false);
    setPendingImportFile(null);
    setVersionMismatchInfo(null);
  };

  const spinner = <Loader2 className="size-4 animate-spin" />;

  return (
    <>
      <SettingsCard
        title="Maintenance"
        description="Routine clean-up that leaves your devices and users in place."
      >
        <ActionRow
          title="Reset Stream Counts"
          description="Set every device's stream count back to zero. Nothing else about the device changes."
          action={
            <Button
              onClick={() => setShowResetStreamCountsModal(true)}
              disabled={resettingStreamCounts}
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
            >
              {resettingStreamCounts && spinner}
              {resettingStreamCounts ? "Resetting..." : "Reset Stream Counts"}
            </Button>
          }
        />

        <ActionRow
          title="Clear Session History"
          description="Permanently delete every session history record. Devices, users and settings are left untouched."
          action={
            <Button
              onClick={() => setShowClearSessionHistoryModal(true)}
              disabled={clearingSessionHistory}
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
            >
              {clearingSessionHistory && spinner}
              {clearingSessionHistory ? "Clearing..." : "Clear Session History"}
            </Button>
          }
        />
      </SettingsCard>

      <SettingsCard
        title="Backup & Restore"
        description="Save your settings, user preferences and policies to a file, or load them back."
      >
        <ActionRow
          title="Export Settings"
          description="Download your settings, user preferences and policies as a file. Devices and session history are not included."
          action={
            <Button
              onClick={exportDatabase}
              disabled={exportingDatabase}
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
            >
              {exportingDatabase && spinner}
              {exportingDatabase ? "Exporting..." : "Export Settings"}
            </Button>
          }
        />

        <ActionRow
          title="Import Settings"
          description="Load settings, user preferences and policies from a file you exported earlier. This overwrites what you have now."
          action={
            <>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={importingDatabase}
                className="hidden"
                id="database-import"
              />
              <label htmlFor="database-import" className="cursor-pointer">
                <Button
                  asChild
                  disabled={importingDatabase}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <span>
                    {importingDatabase && spinner}
                    {importingDatabase ? "Importing..." : "Import Settings"}
                  </span>
                </Button>
              </label>
            </>
          }
        />
      </SettingsCard>

      <SettingsCard
        title="Dangerous Operations"
        description="Nothing here can be undone."
      >
        <ActionRow
          tone="danger"
          title="Delete All Devices"
          description="Permanently delete every device, along with its session history and notifications. Users and application settings are kept, and every device has to be approved again the next time it connects."
          action={
            <Button
              onClick={() => setShowDeleteAllDevicesModal(true)}
              disabled={deletingAllDevices}
              size="sm"
              variant="outline"
              className={`w-full sm:w-auto ${toneButton("danger")}`}
            >
              {deletingAllDevices && spinner}
              {deletingAllDevices ? "Deleting..." : "Delete All Devices"}
            </Button>
          }
        />

        <ActionRow
          tone="danger"
          title="Factory Reset"
          description="Permanently delete everything: settings, devices, user preferences, session history and notifications. Everything restarts as a fresh install."
          action={
            <Button
              onClick={() => setShowResetDatabaseModal(true)}
              disabled={resettingDatabase}
              size="sm"
              variant="outline"
              className={`w-full sm:w-auto ${toneButton("danger")}`}
            >
              {resettingDatabase && spinner}
              {resettingDatabase ? "Resetting..." : "Factory Reset"}
            </Button>
          }
        />
      </SettingsCard>

      <ConfirmationModal
        isOpen={showResetStreamCountsModal}
        onClose={() => setShowResetStreamCountsModal(false)}
        onConfirm={handleResetStreamCounts}
        title="Reset Stream Counts"
        description="Every device's stream count goes back to zero. The devices themselves are kept."
        confirmText="Reset Stream Counts"
        cancelText="Cancel"
        variant="default"
      />

      <ConfirmationModal
        isOpen={showClearSessionHistoryModal}
        onClose={() => setShowClearSessionHistoryModal(false)}
        onConfirm={handleClearSessionHistory}
        title="Clear Session History"
        description="Every session history record is deleted for good, for every user. Devices, users and settings are left untouched."
        confirmText="Clear Session History"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmationModal
        isOpen={showDeleteAllDevicesModal}
        onClose={() => setShowDeleteAllDevicesModal(false)}
        onConfirm={handleDeleteAllDevices}
        title="Delete All Devices"
        description="Every device is deleted for good, along with its session history and notifications. Each one reappears as pending the next time it connects, and per-device settings are lost."
        confirmText="Delete All Devices"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmationModal
        isOpen={showResetDatabaseModal}
        onClose={() => setShowResetDatabaseModal(false)}
        onConfirm={handleResetDatabase}
        title="Factory Reset"
        description="Everything is deleted for good: settings, devices, users and session history. It all restarts as a fresh install."
        confirmText="Yes, Wipe All Data"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Version Mismatch Modal */}
      {versionMismatchInfo && (
        <ConfirmationModal
          isOpen={showVersionMismatchModal}
          onClose={handleCancelImport}
          onConfirm={handleProceedWithImport}
          title="Exported by a Different Version"
          description={`The import file was created with version ${versionMismatchInfo.importVersion}, but you are currently running version ${versionMismatchInfo.currentVersion}. Importing data from a different version may cause compatibility issues. Do you want to proceed anyway?`}
          confirmText="Proceed with Import"
          cancelText="Cancel Import"
          variant="destructive"
        />
      )}

      {/* Password Confirmation Modal */}
      <PasswordConfirmationModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingAction(null);
        }}
        onConfirm={handlePasswordConfirmation}
        title={pendingAction?.title || "Confirm Action"}
        description={
          pendingAction?.description ||
          "Please enter your password to continue."
        }
        isDangerous={pendingAction?.isDangerous}
        isLoading={
          resettingStreamCounts ||
          clearingSessionHistory ||
          deletingAllDevices ||
          resettingDatabase
        }
      />
    </>
  );
}
