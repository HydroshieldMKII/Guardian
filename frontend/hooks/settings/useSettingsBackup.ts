import { useEffect, useState } from "react";
import type { VersionMismatchInfo } from "@/components/settings/settings-utils";
import { useToast } from "@/hooks/use-toast";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { apiClient } from "@/lib/api";
import { downloadJson } from "@/lib/download";
import { RELOAD_DELAY_MS } from "@/hooks/settings/useProtectedActions";

const RESET_SUCCESS_KEY = "guardianResetSuccess";

interface PendingImport {
  file: File;
  versions: VersionMismatchInfo;
}

const exportFilename = () =>
  `guardian-settings-export-${new Date().toISOString().split("T")[0]}.json`;

export function useSettingsBackup(onSettingsRefresh?: () => void) {
  const { toast } = useToast();
  const { versionInfo } = useVersionInfo();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mismatch, setMismatch] = useState<PendingImport | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(RESET_SUCCESS_KEY)) return;
    localStorage.removeItem(RESET_SUCCESS_KEY);
    toast({
      title: "Factory reset complete",
      description: "Everything is back to its default settings.",
      variant: "success",
    });
  }, [toast]);

  const exportSettings = async () => {
    try {
      setExporting(true);
      downloadJson(await apiClient.exportDatabase(), exportFilename());
      toast({
        title: "Settings exported",
        description:
          "Your settings, user preferences and policies were downloaded",
        variant: "success",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export your settings",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const importSettings = async (file: File) => {
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("file", file);
      await apiClient.importDatabase(formData);
      toast({
        title: "Settings imported",
        description: "Applying new settings...",
        variant: "success",
      });
      onSettingsRefresh?.();
      setTimeout(() => {
        localStorage.setItem(RESET_SUCCESS_KEY, "true");
        window.location.reload();
      }, RELOAD_DELAY_MS);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "Failed to import settings",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const checkAndImport = (file: File, content: string) => {
    try {
      const importVersion = (JSON.parse(content) as { version?: string })
        .version;
      const currentVersion = versionInfo?.version;
      if (importVersion && currentVersion && importVersion !== currentVersion) {
        setMismatch({ file, versions: { currentVersion, importVersion } });
        return;
      }
      void importSettings(file);
    } catch {
      toast({
        title: "Invalid file",
        description: "Choose an exported .json settings file",
        variant: "destructive",
      });
    }
  };

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => checkAndImport(file, reader.result as string);
    reader.readAsText(file);
    event.target.value = "";
  };

  const proceedWithImport = () => {
    if (!mismatch) return;
    setMismatch(null);
    void importSettings(mismatch.file);
  };

  return {
    exporting,
    importing,
    mismatch: mismatch?.versions ?? null,
    exportSettings,
    chooseFile,
    proceedWithImport,
    cancelImport: () => setMismatch(null),
  };
}
