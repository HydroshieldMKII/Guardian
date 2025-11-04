"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Settings2,
  Download,
  Upload,
} from "lucide-react";
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
      a.download = `guardian-database-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: "Database has been exported successfully",
        variant: "success",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export database",
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
        description:
          "Database has been imported successfully. Page will reload to reflect changes.",
        variant: "success",
      });

      onSettingsRefresh?.();
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "Failed to import database",
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

  return (
    <>
      <Card>
        <CardHeader className="mt-4">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Administrative Tools
          </CardTitle>
          <CardDescription>
            Dangerous operations for database management. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="p-4 my-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium">Reset Stream Counts</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Reset session counts for all devices. This will not delete
                  devices.
                </p>
              </div>
              <Button
                onClick={() => setShowResetStreamCountsModal(true)}
                disabled={resettingStreamCounts}
                size="sm"
                variant="outline"
              >
                {resettingStreamCounts ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {resettingStreamCounts ? "Resetting..." : "Reset Stream Counts"}
              </Button>
            </div>
          </Card>

          <Card className="p-4 my-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium">
                  Clear All Session History
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Permanently remove all session history from the database.
                </p>
              </div>
              <Button
                onClick={() => setShowClearSessionHistoryModal(true)}
                disabled={clearingSessionHistory}
                size="sm"
                variant="outline"
              >
                {clearingSessionHistory ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {clearingSessionHistory
                  ? "Clearing..."
                  : "Clear Session History"}
              </Button>
            </div>
          </Card>

          {/* Database Management Section */}
          <div className="border-t pt-4 mt-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Download className="h-5 w-5" />
              Database Management
            </h3>

            <Card className="p-4 my-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium">Export Database</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Download a backup copy of your Guardian database including
                    all settings, devices, and history.
                  </p>
                </div>
                <Button
                  onClick={exportDatabase}
                  disabled={exportingDatabase}
                  size="sm"
                  variant="outline"
                >
                  {exportingDatabase ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {exportingDatabase ? "Exporting..." : "Export Database"}
                </Button>
              </div>
            </Card>

            <Card className="p-4 my-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium">Import Database</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Restore Guardian database from a previously exported backup
                    file.
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                    >
                      <span>
                        {importingDatabase ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        {importingDatabase ? "Importing..." : "Import Database"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </Card>
          </div>

          {/* Dangerous Operations Section */}
          <div className="border-t pt-4 mt-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Dangerous Operations
            </h3>

            <Card className="p-4 my-4 border-red-200 dark:border-red-800">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                    Delete All Devices Data
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently remove all device, sessions history and
                    notifications from the database. This action cannot be
                    undone.
                  </p>
                </div>
                <Button
                  onClick={() => setShowDeleteAllDevicesModal(true)}
                  disabled={deletingAllDevices}
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {deletingAllDevices ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {deletingAllDevices ? "Deleting..." : "Delete All Devices"}
                </Button>
              </div>
            </Card>

            <Card className="p-4 my-4 border-red-200 dark:border-red-800">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                    Factory Reset
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>DANGER:</strong> This will permanently delete ALL
                    data including settings, devices, user preferences, sessions
                    history and notifications. Default settings will be
                    restored.
                  </p>
                </div>
                <Button
                  onClick={() => setShowResetDatabaseModal(true)}
                  disabled={resettingDatabase}
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {resettingDatabase ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {resettingDatabase ? "Resetting..." : "Factory Reset"}
                </Button>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>

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
