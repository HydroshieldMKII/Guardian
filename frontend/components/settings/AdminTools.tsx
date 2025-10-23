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
import { config } from "@/lib/config";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
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
  const [showVersionMismatchModal, setShowVersionMismatchModal] =
    useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [versionMismatchInfo, setVersionMismatchInfo] =
    useState<VersionMismatchInfo | null>(null);

  const handleResetStreamCounts = async () => {
    try {
      setResettingStreamCounts(true);
      const response = await fetch(
        `${config.api.baseUrl}/config/scripts/reset-stream-counts`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Stream counts have been reset successfully.",
          variant: "success",
        });
      } else {
        const error = await response.text();
        throw new Error(error);
      }
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

  const handleClearSessionHistory = async () => {
    try {
      setClearingSessionHistory(true);
      const response = await fetch(
        `${config.api.baseUrl}/config/scripts/clear-session-history`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Session history has been cleared successfully.",
          variant: "success",
        });
      } else {
        const error = await response.text();
        throw new Error(error);
      }
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

  const handleDeleteAllDevices = async () => {
    try {
      setDeletingAllDevices(true);
      const response = await fetch(
        `${config.api.baseUrl}/config/scripts/delete-all-devices`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "All devices have been deleted successfully.",
          variant: "success",
        });
        onSettingsRefresh?.();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
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

  const handleResetDatabase = async () => {
    try {
      setResettingDatabase(true);
      const response = await fetch(
        `${config.api.baseUrl}/config/scripts/reset-database`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        toast({
          title: "Success",
          description:
            "Database has been reset successfully. Page will reload.",
          variant: "success",
        });
        onSettingsRefresh?.();
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reset database",
        variant: "destructive",
      });
    } finally {
      setResettingDatabase(false);
      setShowResetDatabaseModal(false);
    }
  };

  const exportDatabase = async () => {
    try {
      setExportingDatabase(true);
      const response = await fetch(
        `${config.api.baseUrl}/config/database/export`,
      );

      if (!response.ok) {
        throw new Error("Failed to export database");
      }

      const blob = await response.blob();
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

      const response = await fetch(
        `${config.api.baseUrl}/config/database/import`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to import database");
      }

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
                    Download a backup copy of your Guardian database including all settings, devices, and history.
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
                    Restore Guardian database from a previously exported backup file.
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
                  <label
                    htmlFor="database-import"
                    className="cursor-pointer"
                  >
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
                  notifications from the database. This action cannot be undone.
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
                  Reset Entire Database
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>DANGER:</strong> This will permanently delete ALL data
                  including settings, devices, user preferences, sessions
                  history and notifications. Default settings will be restored.
                </p>
              </div>
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                <strong>IRREVERSIBLE ACTION:</strong> This will completely wipe
                your Guardian database. Export your database first if you want
                to keep any data. This action cannot be undone.
              </div>
              <Button
                onClick={() => setShowResetDatabaseModal(true)}
                disabled={resettingDatabase}
                size="sm"
                variant="destructive"
              >
                {resettingDatabase ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {resettingDatabase ? "Resetting..." : "Reset Database"}
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
        description="This will reset session counts for all devices. Device records will remain but their stream statistics will be reset to zero. This action cannot be undone."
        confirmText="Reset Stream Counts"
        cancelText="Cancel"
        variant="default"
      />

      <ConfirmationModal
        isOpen={showClearSessionHistoryModal}
        onClose={() => setShowClearSessionHistoryModal(false)}
        onConfirm={handleClearSessionHistory}
        title="Clear All Session History"
        description="This will permanently remove all session history records from the database. This includes viewing history, timestamps, and session metadata for all users. This action cannot be undone."
        confirmText="Clear Session History"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmationModal
        isOpen={showDeleteAllDevicesModal}
        onClose={() => setShowDeleteAllDevicesModal(false)}
        onConfirm={handleDeleteAllDevices}
        title="Delete All Devices"
        description="This will permanently remove all device records from the database. Devices will need to be detected again on their next stream attempt. Device preferences will be lost. This action cannot be undone."
        confirmText="Delete All Devices"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmationModal
        isOpen={showResetDatabaseModal}
        onClose={() => setShowResetDatabaseModal(false)}
        onConfirm={handleResetDatabase}
        title="Reset Entire Database"
        description="DANGER: This will permanently delete ALL data including settings, devices, users, and sessions. Default settings will be restored. This action cannot be undone. Are you absolutely sure you want to proceed?"
        confirmText="Yes, Reset Database"
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
    </>
  );
}
