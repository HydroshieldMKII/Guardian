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
  Download,
  Upload,
  Loader2,
  Database,
  AlertTriangle,
} from "lucide-react";
import { config } from "@/lib/config";
import { useVersion } from "@/contexts/version-context";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { VersionMismatchInfo } from "./settings-utils";

interface DatabaseManagementProps {
  onSettingsRefresh: () => void;
}

export function DatabaseManagement({
  onSettingsRefresh,
}: DatabaseManagementProps) {
  const [exportingDatabase, setExportingDatabase] = useState(false);
  const [importingDatabase, setImportingDatabase] = useState(false);
  const [showVersionMismatchModal, setShowVersionMismatchModal] =
    useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [versionMismatchInfo, setVersionMismatchInfo] =
    useState<VersionMismatchInfo | null>(null);

  const { toast } = useToast();
  const { versionInfo } = useVersion();

  const exportDatabase = async () => {
    try {
      setExportingDatabase(true);
      const response = await fetch(
        `${config.api.baseUrl}/config/database/export`
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
        performImport(importData, file);
      } catch (error) {
        console.error("Import error:", error);
        toast({
          title: "Import failed",
          description: "Invalid file format or corrupted data",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);

    // Clear the input
    event.target.value = "";
  };

  const performImport = async (importData: any, originalFile?: File) => {
    try {
      setImportingDatabase(true);

      // Create FormData and append the file
      const formData = new FormData();

      if (originalFile) {
        // Use the original file if provided
        formData.append("file", originalFile);
      } else {
        // Create a blob from the importData if no original file
        const blob = new Blob([JSON.stringify(importData)], {
          type: "application/json",
        });
        formData.append("file", blob, "database-import.json");
      }

      const response = await fetch(
        `${config.api.baseUrl}/config/database/import`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Handle nested result structure from backend
        const importResult = result.imported || result;
        const imported =
          typeof importResult.imported === "number"
            ? importResult.imported
            : "unknown";
        const skipped =
          typeof importResult.skipped === "number"
            ? importResult.skipped
            : "unknown";

        toast({
          title: "Import successful",
          description: `Imported ${imported} items, skipped ${skipped} items`,
          variant: "success",
        });
        onSettingsRefresh();
      } else {
        throw new Error(result.message || "Import failed");
      }
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
      setVersionMismatchInfo(null);
    }
  };

  const handleVersionMismatchConfirm = () => {
    if (pendingImportFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importData = JSON.parse(content);
          performImport(importData, pendingImportFile);
        } catch (error) {
          console.error("Import error:", error);
          toast({
            title: "Import failed",
            description: "Invalid file format or corrupted data",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(pendingImportFile);
    }
    setShowVersionMismatchModal(false);
  };

  const handleVersionMismatchCancel = () => {
    setShowVersionMismatchModal(false);
    setPendingImportFile(null);
    setVersionMismatchInfo(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="mt-4 mb-4">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Management
          </CardTitle>
          <CardDescription>
            Export and import Guardian database settings and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={exportDatabase}
              disabled={exportingDatabase}
              variant="outline"
              className="w-full"
            >
              {exportingDatabase ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Database
                </>
              )}
            </Button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={importingDatabase}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button
                disabled={importingDatabase}
                variant="outline"
                className="w-full"
              >
                {importingDatabase ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Database
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Database export/import includes all
              settings, user devices, and preferences. Importing will merge data
              with existing data and will overwrite existing if they are already
              present. No data will be deleted during import.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Version Mismatch Modal */}
      <ConfirmationModal
        isOpen={showVersionMismatchModal}
        onClose={handleVersionMismatchCancel}
        onConfirm={handleVersionMismatchConfirm}
        title="Version Mismatch Warning"
        description={
          versionMismatchInfo
            ? `The import file was created with version ${versionMismatchInfo.importVersion}, but you're running version ${versionMismatchInfo.currentVersion}. Importing data from a different version may cause compatibility issues. Do you want to continue?`
            : "Version mismatch detected. Continue with import?"
        }
        confirmText="Import Anyway"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
