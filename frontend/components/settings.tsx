"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Bell,
  Shield,
  Server,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

interface AppSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  type: "string" | "number" | "boolean" | "json";
  encrypted: boolean;
  updatedAt: string;
}

interface SettingsFormData {
  [key: string]: string | boolean | number;
}

const settingsSections = [
  {
    id: "plex",
    title: "Plex Integration",
    description: "Configure Plex server connection and settings",
    icon: Server,
  },
  {
    id: "guardian",
    title: "Guardian Configuration",
    description: "Configure Guardian behavior and settings",
    icon: Shield,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure notification preferences and alert settings",
    icon: Bell,
  },
  {
    id: "profile",
    title: "Profile",
    description: "Manage your account profile and personal information",
    icon: User,
  },
];

export function Settings() {
  const [activeSection, setActiveSection] = useState("plex");
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [formData, setFormData] = useState<SettingsFormData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/pg/config");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);

        // Initialize form data
        const initialFormData: SettingsFormData = {};
        data.forEach((setting: AppSetting) => {
          if (setting.type === "boolean") {
            initialFormData[setting.key] = setting.value === "true";
          } else if (setting.type === "number") {
            initialFormData[setting.key] = parseFloat(setting.value);
          } else {
            initialFormData[setting.key] = setting.encrypted
              ? ""
              : setting.value;
          }
        });
        setFormData(initialFormData);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToUpdate = Object.entries(formData)
        .filter(([key, value]) => {
          // Only include changed values
          const originalSetting = settings.find((s) => s.key === key);
          if (!originalSetting) return false;

          let originalValue: any = originalSetting.value;
          if (originalSetting.type === "boolean") {
            originalValue = originalValue === "true";
          } else if (originalSetting.type === "number") {
            originalValue = parseFloat(originalValue);
          }

          return (
            value !== originalValue &&
            !(originalSetting.encrypted && value === "")
          );
        })
        .map(([key, value]) => ({ key, value }));

      if (settingsToUpdate.length === 0) {
        return;
      }

      const response = await fetch("/api/pg/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsToUpdate),
      });

      if (response.ok) {
        await fetchSettings(); // Refresh settings
        setConnectionStatus(null); // Clear connection status
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch("/api/pg/config/test-plex-connection", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        setConnectionStatus(result);
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: "Failed to test connection",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getSettingsByCategory = (category: string) => {
    const categoryMap: Record<string, string[]> = {
      plex: [
        "PLEX_TOKEN",
        "PLEX_SERVER_IP",
        "PLEX_SERVER_PORT",
        "USE_SSL",
        // IGNORE_CERT_ERRORS will be handled specially with USE_SSL
      ],
      guardian: [
        "PLEXGUARD_REFRESH_INTERVAL",
        "PLEX_GUARD_DEFAULT_BLOCK",
        "PLEXGUARD_STOPMSG",
        "PLEXGUARD_FRONTEND_PORT",
      ],
    };

    return settings.filter(
      (setting) => categoryMap[category]?.includes(setting.key) || false
    );
  };

  const renderSettingField = (setting: AppSetting) => {
    const value = formData[setting.key];

    if (setting.type === "boolean") {
      return (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{setting.key.replace(/_/g, " ")}</Label>
            <p className="text-xs text-muted-foreground">
              {setting.description}
            </p>
          </div>
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) =>
              handleInputChange(setting.key, checked)
            }
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label>{setting.key.replace(/_/g, " ")}</Label>
        <Input
          type={
            setting.encrypted
              ? "password"
              : setting.type === "number"
                ? "number"
                : "text"
          }
          value={String(value || "")}
          onChange={(e) => {
            const newValue =
              setting.type === "number"
                ? parseFloat(e.target.value) || 0
                : e.target.value;
            handleInputChange(setting.key, newValue);
          }}
          placeholder={
            setting.encrypted && !value ? "••••••••••••••••••••" : ""
          }
        />
        <p className="text-xs text-muted-foreground">
          {setting.description}
          {setting.key === "PLEXGUARD_FRONTEND_PORT" && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              ⚠️ Restart the frontend server for port changes to take effect
            </span>
          )}
        </p>
      </div>
    );
  };

  const renderSSLSettings = () => {
    const useSSLSetting = settings.find(s => s.key === "USE_SSL");
    const ignoreCertSetting = settings.find(s => s.key === "IGNORE_CERT_ERRORS");
    
    if (!useSSLSetting || !ignoreCertSetting) return null;
    
    const isSSLEnabled = Boolean(formData["USE_SSL"]);
    
    return (
      <Card className="p-4">
        <div className="space-y-4">
          {/* Use SSL Setting */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable SSL</Label>
              <p className="text-xs text-muted-foreground">
                {useSSLSetting.description}
              </p>
            </div>
            <Switch
              checked={isSSLEnabled}
              onCheckedChange={(checked) =>
                handleInputChange("USE_SSL", checked)
              }
            />
          </div>
          
          {/* Ignore Cert Errors Setting - Indented and conditional */}
          <div className={`ml-4 pl-4 border-l-2 ${isSSLEnabled ? 'border-border' : 'border-muted'}`}>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className={!isSSLEnabled ? 'text-muted-foreground' : ''}>
                  Ignore SSL certificate errors
                </Label>
                <p className={`text-xs ${!isSSLEnabled ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                  {ignoreCertSetting.description}
                </p>
              </div>
              <Switch
                checked={Boolean(formData["IGNORE_CERT_ERRORS"])}
                disabled={!isSSLEnabled}
                onCheckedChange={(checked) =>
                  handleInputChange("IGNORE_CERT_ERRORS", checked)
                }
              />
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderSectionContent = (sectionId: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }

    switch (sectionId) {
      case "plex":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Plex Server Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Configure your connection to the Plex Media Server.
              </p>
            </div>

            <div className="space-y-4">
              {getSettingsByCategory("plex")
                .filter(setting => setting.key !== "USE_SSL") // Handle SSL settings separately
                .map((setting) => (
                <Card key={setting.key} className="p-4">
                  {renderSettingField(setting)}
                </Card>
              ))}
              
              {/* Special SSL Settings Group */}
              {renderSSLSettings()}
            </div>

            {/* Connection Test */}
            <Card className="p-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Connection Test</h4>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    size="sm"
                    variant="outline"
                  >
                    {testingConnection ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Test Connection
                  </Button>

                  {connectionStatus && (
                    <div
                      className={`flex items-center space-x-1 text-sm ${
                        connectionStatus.success
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {connectionStatus.success ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span>{connectionStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        );

      case "guardian":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Guardian Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Configure Guardian behavior and monitoring settings.
              </p>
            </div>

            <div className="space-y-4">
              {getSettingsByCategory("guardian").map((setting) => (
                <Card key={setting.key} className="p-4">
                  {renderSettingField(setting)}
                </Card>
              ))}
            </div>

            {/* Port Change Notice */}
            <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Port Configuration
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Changes to the frontend port will take effect on the next application restart. 
                    Use the configuration-aware startup scripts to automatically apply the saved port setting.
                  </p>
                  <div className="space-y-1">
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-mono bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">
                      <div className="font-semibold mb-1">Recommended startup commands:</div>
                      <div>Development: <code>npm run dev:config</code></div>
                      <div>Production: <code>npm run start:config</code></div>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      These scripts will automatically read the port configuration from the database before starting.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Notification Settings</h3>
              <p className="text-sm text-muted-foreground">
                Control how you receive notifications and alerts.
              </p>
            </div>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Notification settings will be implemented in a future version.
              </p>
            </Card>
          </div>
        );

      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Profile Settings</h3>
              <p className="text-sm text-muted-foreground">
                Manage your account profile and preferences.
              </p>
            </div>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Profile settings will be implemented in a future version.
              </p>
            </Card>
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Select a settings category to configure.
            </p>
          </div>
        );
    }
  };

  const hasChanges = () => {
    return Object.entries(formData).some(([key, value]) => {
      const originalSetting = settings.find((s) => s.key === key);
      if (!originalSetting) return false;

      let originalValue: any = originalSetting.value;
      if (originalSetting.type === "boolean") {
        originalValue = originalValue === "true";
      } else if (originalSetting.type === "number") {
        originalValue = parseFloat(originalValue);
      }

      return (
        value !== originalValue && !(originalSetting.encrypted && value === "")
      );
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Settings
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Configure your Guardian dashboard and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Navigation */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription>Choose a category to configure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-0">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    activeSection === section.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <section.icon className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{section.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {section.description}
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Settings Content */}
          <Card className="lg:col-span-3">
            <CardContent className="p-6">
              {renderSectionContent(activeSection)}

              {/* Save Button - Only show for configurable sections */}
              {(activeSection === "plex" || activeSection === "guardian") && (
                <>
                  <Separator className="my-6" />
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={fetchSettings}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving || !hasChanges()}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
