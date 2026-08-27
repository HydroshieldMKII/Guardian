"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, StatusPill } from "@/components/ui/entity";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/settings-context";
import { useVersion } from "@/contexts/version-context";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { apiClient } from "@/lib/api";

import { PlexSettings } from "@/components/settings/PlexSettings";
import { SMTPSettings } from "@/components/settings/SMTPSettings";
import { AppriseSettings } from "@/components/settings/AppriseSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { AdminTools } from "@/components/settings/AdminTools";
import { SystemInfo } from "@/components/settings/SystemInfo";
import { SettingsFormData } from "@/components/settings/settings-utils";
import { ThreeDotLoader } from "@/components/three-dot-loader";

// Valid tab IDs for URL hash validation
const validTabs = [
  "plex",
  "guardian",
  "customization",
  "smtp",
  "notifications",
  "admin",
  "system",
];

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { settings, loading, refreshSettings, updateSettings } = useSettings();
  const { versionInfo } = useVersion();
  const {
    setHasUnsavedChanges: setGlobalUnsavedChanges,
    setOnSaveAndLeave,
    setOnDiscardChanges,
  } = useUnsavedChanges();

  const [formData, setFormData] = useState<SettingsFormData>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Initialize from URL hash if available (client-side only)
    if (typeof window !== "undefined") {
      const hash = window.location.hash.slice(1);
      if (hash && validTabs.includes(hash)) {
        return hash;
      }
    }
    return "plex";
  });

  // Sync URL hash with active tab
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${activeTab}`);
    }
  }, [activeTab]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Initialize form data when settings load
  useEffect(() => {
    if (settings && settings.length > 0) {
      const initialData: SettingsFormData = {};
      settings.forEach((setting) => {
        initialData[setting.key] = setting.value;
      });
      setFormData(initialData);
    }
  }, [settings]);

  // Track unsaved changes
  useEffect(() => {
    if (settings && settings.length > 0) {
      const hasChanges = settings.some((setting) => {
        const currentValue = formData[setting.key];
        if (currentValue === undefined) return false;

        const normalizeValue = (value: any) => {
          if (typeof value === "boolean") return String(value);
          if (typeof value === "string") return value;
          return String(value);
        };

        return normalizeValue(currentValue) !== normalizeValue(setting.value);
      });
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, settings]);

  // Sync local unsaved changes with global context
  useEffect(() => {
    setGlobalUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setGlobalUnsavedChanges]);

  // Save handler for navbar context
  const performSave = useCallback(async () => {
    if (!hasUnsavedChanges || !settings) return;

    setIsSaving(true);
    try {
      const changedSettings = settings
        .filter((setting) => {
          const newValue = formData[setting.key];
          return newValue !== undefined && newValue !== setting.value;
        })
        .map((setting) => ({
          key: setting.key,
          value: String(formData[setting.key]),
          type: setting.type,
        }));

      if (changedSettings.length === 0) return;

      await apiClient.updateConfig(changedSettings);

      updateSettings(
        changedSettings.map((setting) => ({
          key: setting.key,
          value: setting.value,
        })),
      );

      toast({
        title: "Settings Saved",
        description: `${changedSettings.length} ${changedSettings.length === 1 ? "setting" : "settings"} updated.`,
        variant: "success",
      });

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
      throw error; // Re-throw so navbar knows save failed
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, settings, formData, updateSettings, toast]);

  // Discard handler for navbar context
  const performDiscard = useCallback(() => {
    if (settings && settings.length > 0) {
      const originalData: SettingsFormData = {};
      settings.forEach((setting) => {
        originalData[setting.key] = setting.value;
      });
      setFormData(originalData);
    }
    setHasUnsavedChanges(false);
  }, [settings]);

  // Register callbacks with the global context
  useEffect(() => {
    setOnSaveAndLeave(performSave);
    setOnDiscardChanges(performDiscard);

    // Cleanup on unmount
    return () => {
      setGlobalUnsavedChanges(false);
      setOnSaveAndLeave(null);
      setOnDiscardChanges(null);
    };
  }, [
    performSave,
    performDiscard,
    setOnSaveAndLeave,
    setOnDiscardChanges,
    setGlobalUnsavedChanges,
  ]);

  const handleFormDataChange = (updates: Partial<SettingsFormData>) => {
    setFormData((prev) => {
      const updated = { ...prev };
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updated[key] = value;
        }
      });
      return updated;
    });
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      handleBack();
    }
  };

  const handleConfirmLeave = () => {
    setShowUnsavedWarning(false);
    handleBack();
  };

  const handleCancelLeave = () => {
    setShowUnsavedWarning(false);
  };

  const handleSaveAndLeave = async () => {
    setShowUnsavedWarning(false);
    await handleSave();
    handleBack();
  };

  const handleCancel = () => {
    // Reset form data to original settings values
    if (settings && settings.length > 0) {
      const originalData: SettingsFormData = {};
      settings.forEach((setting) => {
        originalData[setting.key] = setting.value;
      });
      setFormData(originalData);
    }
    setHasUnsavedChanges(false);
  };

  const handleBack = () => {
    router.push("/");
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      toast({
        title: "No Changes",
        description: "Nothing has been edited yet.",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Prepare the data to send
      const changedSettings = settings
        ?.filter((setting) => {
          const newValue = formData[setting.key];
          return newValue !== undefined && newValue !== setting.value;
        })
        .map((setting) => ({
          key: setting.key,
          value: String(formData[setting.key]),
          type: setting.type,
        }));

      if (!changedSettings || changedSettings.length === 0) {
        toast({
          title: "No Changes",
          description: "Nothing has been edited yet.",
        });
        return;
      }

      await apiClient.updateConfig(changedSettings);

      updateSettings(
        changedSettings.map((setting) => ({
          key: setting.key,
          value: setting.value,
        })),
      );

      toast({
        title: "Settings Saved",
        description: `${changedSettings.length} ${changedSettings.length === 1 ? "setting" : "settings"} updated.`,
        variant: "success",
      });

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ThreeDotLoader />
      </div>
    );
  }

  if (!settings || settings.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          title="Settings Unavailable"
          description="Settings could not be loaded. Refresh the page to try again."
        />
      </div>
    );
  }

  const tabs = [
    {
      id: "plex",
      label: "Plex",
      description: "How to reach your Plex Media Server",
    },
    {
      id: "guardian",
      label: "Guardian",
      description: "How devices, users and streams are treated",
    },
    {
      id: "customization",
      label: "Customization",
      description: "What you see, and what your users are told",
    },
    {
      id: "smtp",
      label: "Email",
      description: "Send notifications by email through your own SMTP server",
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Which events you are told about, and where",
    },
    {
      id: "admin",
      label: "Maintenance",
      description: "Back up your settings, clean up data, or start over",
    },
    {
      id: "system",
      label: "System",
      description: "Which version you are running, and whether one is newer",
    },
  ];

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div
      className={`container mx-auto max-w-6xl px-4 py-6 ${
        hasUnsavedChanges ? "pb-32" : ""
      }`}
    >
      <header className="mb-8 space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Settings
          </h1>
          {versionInfo && (
            <button
              type="button"
              onClick={() => setActiveTab("system")}
              title="View system information"
              className="cursor-pointer rounded-full transition-opacity hover:opacity-80"
            >
              <StatusPill tone="neutral">v{versionInfo.version}</StatusPill>
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          >
            Back to Dashboard
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure application settings and preferences
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger
            aria-label="Settings section"
            className="w-full cursor-pointer sm:hidden"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.id} value={tab.id}>
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TabsList className="hidden h-auto w-full gap-1 rounded-lg bg-muted/60 p-1 sm:inline-flex">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex-1 cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {activeTabMeta && (
          <p className="mt-4 text-sm text-muted-foreground">
            {activeTabMeta.description}
          </p>
        )}

        <div className="mt-6">
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-6">
              {tab.id === "plex" && (
                <PlexSettings
                  settings={settings}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              )}

              {tab.id === "smtp" && (
                <SMTPSettings
                  settings={settings}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              )}

              {tab.id === "system" && (
                <SystemInfo
                  settings={settings}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                />
              )}

              {(tab.id === "guardian" || tab.id === "customization") && (
                <GeneralSettings
                  settings={settings}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                  sectionId={tab.id}
                />
              )}

              {tab.id === "notifications" && (
                <div className="space-y-6">
                  <GeneralSettings
                    settings={settings}
                    formData={formData}
                    onFormDataChange={handleFormDataChange}
                    sectionId={tab.id}
                  />
                  <AppriseSettings
                    settings={settings}
                    formData={formData}
                    onFormDataChange={handleFormDataChange}
                    hasUnsavedChanges={hasUnsavedChanges}
                  />
                </div>
              )}

              {tab.id === "admin" && (
                <AdminTools onSettingsRefresh={refreshSettings} />
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {hasUnsavedChanges && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-2 shrink-0 animate-pulse rounded-full bg-amber-500"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  You have unsaved changes
                </p>
                <p className="text-xs text-muted-foreground">
                  Save them to apply the new configuration.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCancel}
                disabled={isSaving}
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                Save Now
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={showUnsavedWarning}
        onOpenChange={(open) => !open && setShowUnsavedWarning(false)}
        size="md"
      >
        <ModalHeader
          title="Unsaved Changes"
          description="You have unsaved changes that will be lost if you leave this page. What would you like to do?"
        />
        <ModalFooter>
          <Button variant="outline" onClick={handleCancelLeave}>
            Stay on Page
          </Button>
          <Button variant="destructive" onClick={handleConfirmLeave}>
            Discard Changes
          </Button>
          <Button onClick={handleSaveAndLeave} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Save & Leave
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
