"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  Settings as SettingsIcon,
  Database,
  Mail,
  Server,
  Palette,
  Bell,
  Wrench,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { AppSetting } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/settings-context";
import { useVersion } from "@/contexts/version-context";
import { config } from "@/lib/config";

import { PlexSettings } from "./settings/PlexSettings";
import { SMTPSettings } from "./settings/SMTPSettings";
import { DatabaseManagement } from "./settings/DatabaseManagement";
import { GeneralSettings } from "./settings/GeneralSettings";
import { AdminTools } from "./settings/AdminTools";
import { SettingsFormData } from "./settings/settings-utils";

interface SettingsProps {
  onBack?: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { toast } = useToast();
  const { settings, loading, refreshSettings, updateSettings } = useSettings();
  const { versionInfo } = useVersion();

  const [formData, setFormData] = useState<SettingsFormData>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("plex");

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
        return currentValue !== undefined && currentValue !== setting.value;
      });
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, settings]);

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

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      toast({
        title: "No Changes",
        description: "There are no changes to save.",
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
          description: "There are no changes to save.",
        });
        return;
      }

      const response = await fetch(`${config.api.baseUrl}/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changedSettings),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save settings");
      }

      updateSettings(
        changedSettings.map((setting) => ({
          key: setting.key,
          value: setting.value,
        }))
      );

      toast({
        title: "Settings Saved",
        description: `Successfully updated ${changedSettings.length} setting(s).`,
        variant: "success",
      });

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      await refreshSettings();
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

  const getTabIcon = (tabId: string) => {
    switch (tabId) {
      case "plex":
        return Server;
      case "smtp":
        return Mail;
      case "database":
        return Database;
      case "guardian":
        return SettingsIcon;
      case "customization":
        return Palette;
      case "notifications":
        return Bell;
      case "admin":
        return Wrench;
      default:
        return SettingsIcon;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  if (!settings || settings.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Settings Unavailable</CardTitle>
          <CardDescription>
            Unable to load application settings. Please try refreshing the page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tabs = [
    {
      id: "plex",
      label: "Plex Integration",
      description:
        "Configure your Plex Media Server connection and related settings",
    },
    {
      id: "guardian",
      label: "Guardian",
      description: "Core Guardian behavior settings",
    },
    {
      id: "customization",
      label: "Customization",
      description: "UI and user experience settings",
    },
    {
      id: "smtp",
      label: "Email/SMTP",
      description: "Email notification configuration",
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Notification preferences",
    },
    {
      id: "database",
      label: "Database",
      description: "Database management and backup",
    },
    {
      id: "admin",
      label: "Admin Tools",
      description: "Administrative tools and system maintenance",
    },
  ];

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Back Button */}
      {onBack && (
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      )}

      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              {versionInfo && (
                <Badge variant="outline" className="text-xs font-medium">
                  v{versionInfo.version}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-base">
              Configure Guardian application settings and preferences
            </p>
          </div>
        </div>

        {/* Unsaved Changes Warning */}
        {hasUnsavedChanges && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center gap-3">
            <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                You have unsaved changes
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                Don't forget to save your changes before leaving this page
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save Now
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 h-auto p-1 mb-4 justify-items-stretch">
          {tabs.map((tab) => {
            const IconComponent = getTabIcon(tab.id);
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm h-auto min-h-[2.5rem] justify-self-start w-full"
              >
                <IconComponent className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="text-[10px] sm:text-sm leading-tight text-center">
                  {tab.label}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="space-y-6 mt-6">
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-6">
              {/* Render the appropriate component for each tab */}
              {tab.id === "plex" && (
                <PlexSettings
                  settings={settings}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                />
              )}

              {tab.id === "smtp" && (
                <SMTPSettings
                  settings={settings}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                />
              )}

              {tab.id === "database" && (
                <DatabaseManagement onSettingsRefresh={refreshSettings} />
              )}

              {(tab.id === "guardian" ||
                tab.id === "customization" ||
                tab.id === "notifications") && (
                <GeneralSettings
                  settings={settings}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                  sectionId={tab.id}
                />
              )}

              {tab.id === "admin" && (
                <AdminTools onSettingsRefresh={refreshSettings} />
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
