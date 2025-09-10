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
import { useToast } from "@/hooks/use-toast";
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
  ArrowLeft,
  Download,
  Upload,
  Database,
} from "lucide-react";

interface AppSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  type: "string" | "number" | "boolean" | "json";
  private: boolean;
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
    id: "database",
    title: "Database Management",
    description: "Export and import database settings and data",
    icon: Database,
  },
  // {
  //   id: "notifications",
  //   title: "Notifications",
  //   description: "Configure notification preferences and alert settings",
  //   icon: Bell,
  // },
  // {
  //   id: "profile",
  //   title: "Profile",
  //   description: "Manage your account profile and personal information",
  //   icon: User,
  // },
];

export function Settings({ onBack }: { onBack?: () => void } = {}) {
  const [activeSection, setActiveSection] = useState("plex");
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [formData, setFormData] = useState<SettingsFormData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [exportingDatabase, setExportingDatabase] = useState(false);
  const [importingDatabase, setImportingDatabase] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setBackendError(null);
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
            initialFormData[setting.key] = setting.private
              ? ""
              : setting.value;
          }
        });
        setFormData(initialFormData);
      } else {
        // Try to get the error message from the response
        const errorData = await response.json().catch(() => ({}));
        setBackendError(errorData.error || `Server error (${response.status})`);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      setBackendError(
        "Unable to connect to backend service. Please ensure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateSettings = (
    settingsToUpdate: { key: string; value: any }[]
  ) => {
    const errors: string[] = [];
    
    for (const setting of settingsToUpdate) {
      switch (setting.key) {
        case 'PLEX_SERVER_PORT':
          const port = Number(setting.value);
          if (isNaN(port) || port < 1 || port > 65535) {
            errors.push('Port must be a number between 1 and 65535');
          }
          break;
        case 'PLEXGUARD_REFRESH_INTERVAL':
          const interval = Number(setting.value);
          if (isNaN(interval) || interval < 1) {
            errors.push('Refresh interval must be a positive number');
          }
          break;
        case 'PLEX_SERVER_IP':
          if (!setting.value || setting.value.trim().length === 0) {
            errors.push('Plex server IP is required');
          }
          break;
        case 'PLEX_TOKEN':
          if (!setting.value || setting.value.trim().length === 0) {
            errors.push('Plex token is required');
          }
          break;
          default:
            console.warn(`No validation rules for setting: ${setting.key}`);
            break;
      }
    }
    
    return errors;
  };

  const shouldAutoTestConnection = (
    settingsToUpdate: { key: string; value: any }[]
  ) => {
    const plexKeys = [
      "PLEX_SERVER_IP",
      "PLEX_SERVER_PORT",
      "PLEX_TOKEN",
      "USE_SSL",
      "IGNORE_CERT_ERRORS",
    ];
    return settingsToUpdate.some((update) => plexKeys.includes(update.key));
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
            !(originalSetting.private && value === "")
          );
        })
        .map(([key, value]) => ({ key, value }));

      if (settingsToUpdate.length === 0) {
        return;
      }

      // Validate settings
      const validationErrors = validateSettings(settingsToUpdate);
      if (validationErrors.length > 0) {
        setConnectionStatus({
          success: false,
          message: `Validation error: ${validationErrors.join(", ")}`,
        });
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

        // Show success toast
        toast({
          title: "Settings saved",
          description: `Successfully updated ${settingsToUpdate.length} setting${settingsToUpdate.length !== 1 ? 's' : ''}`,
          variant: "success",
        });

        // Auto-test Plex connection if Plex settings were changed
        if (shouldAutoTestConnection(settingsToUpdate)) {
          setConnectionStatus({
            success: false,
            message: "Testing connection with new settings...",
          });
          // Small delay to show the "testing" message
          setTimeout(async () => {
            await handleTestConnection();
          }, 500);
        } else {
          setConnectionStatus(null); // Clear connection status for non-Plex changes
        }
      } else {
        // Handle save error
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Server error (${response.status})`;
        toast({
          title: "Failed to save settings",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Network Error",
        description: "Failed to save settings. Please check your connection.",
        variant: "destructive",
      });
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
      } else {
        // Try to get the error message from the response
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Server error (${response.status})`;
        setConnectionStatus({
          success: false,
          message: errorMessage,
        });
      }
    } catch (error) {
      const errorMessage = "Failed to test connection - unable to reach server";
      setConnectionStatus({
        success: false,
        message: errorMessage,
      });
      
      // Only show toast if it's a network/backend error (unable to reach server)
      toast({
        title: "Network Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleExportDatabase = async () => {
    setExportingDatabase(true);
    try {
      const response = await fetch("/api/pg/config/database/export");
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `guardian-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export successful",
          description: "Database backup downloaded successfully",
          variant: "success",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Export failed",
          description: errorData.message || `Server error (${response.status})`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Failed to export database. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setExportingDatabase(false);
    }
  };

  const handleImportDatabase = async (file: File) => {
    setImportingDatabase(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch("/api/pg/config/database/import", {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Import successful",
          description: `Successfully imported ${result.imported.imported} items, ${result.imported.skipped} items skipped`,
          variant: "success",
        });
        
        // Refresh settings after import
        await fetchSettings();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Import failed",
          description: errorData.message || `Server error (${response.status})`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Failed to import database. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setImportingDatabase(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        handleImportDatabase(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a JSON file for import",
          variant: "destructive",
        });
      }
    }
    // Reset the input value so the same file can be selected again
    event.target.value = '';
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
            className="cursor-pointer"
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label>{setting.key.replace(/_/g, " ")}</Label>
        <Input
          type={
            setting.private
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
            setting.private && !value ? "••••••••••••••••••••" : ""
          }
        />
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      </div>
    );
  };

  const renderSSLSettings = () => {
    const useSSLSetting = settings.find((s) => s.key === "USE_SSL");
    const ignoreCertSetting = settings.find(
      (s) => s.key === "IGNORE_CERT_ERRORS"
    );

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
              className="cursor-pointer"
            />
          </div>

          {/* Ignore Cert Errors Setting - Indented and conditional */}
          <div
            className={`ml-4 pl-4 border-l-2 ${isSSLEnabled ? "border-border" : "border-muted"}`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className={!isSSLEnabled ? "text-muted-foreground" : ""}>
                  Ignore SSL certificate errors (not recommended with public domaines or on public networks)
                </Label>
                <p
                  className={`text-xs ${!isSSLEnabled ? "text-muted-foreground/60" : "text-muted-foreground"}`}
                >
                  {ignoreCertSetting.description}
                </p>
              </div>
              <Switch
                checked={Boolean(formData["IGNORE_CERT_ERRORS"])}
                disabled={!isSSLEnabled}
                onCheckedChange={(checked) =>
                  handleInputChange("IGNORE_CERT_ERRORS", checked)
                }
                className={!isSSLEnabled ? "" : "cursor-pointer"}
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
                .filter((setting) => setting.key !== "USE_SSL") // Handle SSL settings separately
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
                          ? "text-green-500"
                          : "text-yellow-600"
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
          </div>
        );

      case "database":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Database Management</h3>
              <p className="text-sm text-muted-foreground">
                Export and import your Guardian database for backup and migration purposes.
              </p>
            </div>

            <div className="space-y-4">
              {/* Export Database */}
              <Card className="p-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium">Export Database</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Download a backup of your Guardian database. Private settings will not be included for security.
                    </p>
                  </div>
                  <Button
                    onClick={handleExportDatabase}
                    disabled={exportingDatabase}
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
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

              {/* Import Database */}
              <Card className="p-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium">Import Database</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Import a Guardian database backup. This will merge the imported data with existing data.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      disabled={importingDatabase}
                      className="hidden"
                      id="database-import"
                    />
                    <Button
                      type="button"
                      disabled={importingDatabase}
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => document.getElementById('database-import')?.click()}
                    >
                      {importingDatabase ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {importingDatabase ? "Importing..." : "Import Database"}
                    </Button>
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border">
                    <strong>Warning:</strong> Importing a database will merge data with your current database. 
                    Consider exporting your current database first as a backup.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );

      // case "notifications":
      //   return (
      //     <div className="space-y-6">
      //       <div>
      //         <h3 className="text-lg font-medium">Notification Settings</h3>
      //         <p className="text-sm text-muted-foreground">
      //           Control how you receive notifications and alerts.
      //         </p>
      //       </div>
      //       <Card className="p-4">
      //         <p className="text-sm text-muted-foreground">
      //           Notification settings will be implemented in a future version.
      //         </p>
      //       </Card>
      //     </div>
      //   );

      // case "profile":
      //   return (
      //     <div className="space-y-6">
      //       <div>
      //         <h3 className="text-lg font-medium">Profile Settings</h3>
      //         <p className="text-sm text-muted-foreground">
      //           Manage your account profile and preferences.
      //         </p>
      //       </div>
      //       <Card className="p-4">
      //         <p className="text-sm text-muted-foreground">
      //           Profile settings will be implemented in a future version.
      //         </p>
      //       </Card>
      //     </div>
      //   );

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
        value !== originalValue && !(originalSetting.private && value === "")
      );
    });
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 min-h-[calc(100vh-3.5rem)]">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Back Button */}
        {onBack && (
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Settings
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Configure your Guardian dashboard and preferences
          </p>
        </div>

        {/* Backend Error Display */}
        {backendError && (
          <div className="mb-6">
            <Card className="border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-950/20">
              <CardContent>
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                      Backend Connection Error
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      {backendError}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSettings}
                    className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Navigation */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription>Choose a category to configure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-0">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer ${
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
