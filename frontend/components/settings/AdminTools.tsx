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
        title: "Success",
        description: "New settings have been successfully applied.",
        variant: "success",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetStreamCounts = async (password?: string) => {
    if (!password) {
      setPendingAction({
        type: "resetStreamCounts",
        title: "Reset Stream Counts",
        description:
          "Please enter your password to reset all stream statistics.",
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
        title: "Success",
        description: "Stream counts have been reset successfully.",
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
    if (!password) {
      setPendingAction({
        type: "clearSessionHistory",
        title: "Clear Session History",
        description:
          "Please enter your password to permanently delete all session history records.",
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
        title: "Success",
        description: "Session history has been cleared successfully.",
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
    if (!password) {
      setPendingAction({
        type: "deleteAllDevices",
        title: "Delete All Devices",
        description:
          "Please enter your password to permanently delete all device records. Users will need re-approval.",
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
        title: "Success",
        description: "All devices have been deleted successfully.",
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
    if (!password) {
      setPendingAction({
        type: "resetDatabase",
        title: "Factory Reset",
        description:
          "Please enter your password to completely wipe all your data and restore default settings.",
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
        title: "Export successful",
        description: "Settings have been exported successfully",
        variant: "success",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export settings",
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
          title: "Invalid file",
          description: "Please select a valid Guardian export file",
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
        title: "Import successful",
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
        title: "Import failed",
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
        title="Administrative Tools"
        description="Maintenance operations for the Guardian database."
      >
        <ActionRow
          title="Reset Stream Counts"
          description="Reset session counts for all devices. This will not delete devices."
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
          title="Clear All Session History"
          description="Permanently remove all session history from the database."
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
        title="Settings Management"
        description="Export and restore Guardian settings, user preferences and policies."
      >
        <ActionRow
          title="Export Settings"
          description="Download a partial backup of your Guardian data including settings, users preferences and users policies."
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
          description="Restore Guardian settings from a previously exported backup file."
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
        description="These actions are irreversible. Export your settings first."
      >
        <ActionRow
          tone="danger"
          title="Delete All Devices Data"
          description="Permanently remove all device, sessions history and notifications from the database. This action cannot be undone."
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
          description="DANGER: This will permanently delete ALL data including settings, devices, user preferences, sessions history and notifications. Default settings will be restored."
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
        description="This will reset session counts for all devices. Device records will remain but their stream statistics will be reset to zero."
        confirmText="Reset Stream Counts"
        cancelText="Cancel"
        variant="default"
      />

      <ConfirmationModal
        isOpen={showClearSessionHistoryModal}
        onClose={() => setShowClearSessionHistoryModal(false)}
        onConfirm={handleClearSessionHistory}
        title="Clear All Session History"
        description="This will permanently remove all session history records from the database. This includes viewing history, timestamps, and session metadata for all users."
        confirmText="Clear Session History"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmationModal
        isOpen={showDeleteAllDevicesModal}
        onClose={() => setShowDeleteAllDevicesModal(false)}
        onConfirm={handleDeleteAllDevices}
        title="Delete All Devices"
        description="This will permanently remove all device records from the database. Devices will need to be detected again on their next stream attempt. Device preferences will be lost."
        confirmText="Delete All Devices"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmationModal
        isOpen={showResetDatabaseModal}
        onClose={() => setShowResetDatabaseModal(false)}
        onConfirm={handleResetDatabase}
        title="Factory Reset"
        description="DANGER: This will permanently delete ALL data including settings, devices, users, and sessions. Default settings will be restored like a fresh install."
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
          title="Version Mismatch Warning"
          description={`The import file was created with Guardian version ${versionMismatchInfo.importVersion}, but you are currently running version ${versionMismatchInfo.currentVersion}. Importing data from a different version may cause compatibility issues. Do you want to proceed anyway?`}
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
