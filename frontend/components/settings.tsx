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
  AlertTriangle,
  ChevronDown,
  Activity,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { config } from "../lib/config";

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
    id: "guardian",
    title: "Guardian Configuration",
    description: "Configure Guardian behavior and settings",
    icon: Shield,
  },
  {
    id: "plex",
    title: "Plex Integration",
    description: "Configure Plex server connection and settings",
    icon: Server,
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

// Function to get setting label and description
const getSettingInfo = (setting: AppSetting): { label: string; description: string } => {
  const settingInfoMap: Record<string, { label: string; description?: string }> = {
    'PLEX_SERVER_IP': { label: 'Plex server IP address' },
    'PLEX_SERVER_PORT': { label: 'Plex server port' },
    'PLEX_TOKEN': { label: 'Authentication token' },
    'PLEXGUARD_REFRESH_INTERVAL': { label: 'Refresh interval' },
    'PLEXGUARD_STOPMSG': { label: 'Message' },
    'PLEX_GUARD_DEFAULT_BLOCK': { label: 'Default behavior for new devices' },
    'DEVICE_CLEANUP_ENABLED': { 
      label: 'Automatic device cleanup',
      description: 'When enabled, devices that haven\'t streamed for the specified number of days will be automatically removed and require approval again.'
    },
    'DEVICE_CLEANUP_INTERVAL_DAYS': { 
      label: 'Device inactivity threshold (days)',
      description: 'Number of days a device can be inactive before it\'s automatically removed. Cleanup runs every hour.'
    },
    'DEFAULT_PAGE': {
      label: 'Default page on startup',
      description: 'Choose which page to display when the app loads'
    },
    'AUTO_CHECK_UPDATES': {
      label: 'Automatic update checking',
      description: 'Automatically check for new Guardian releases when the app launches'
    },
  };
  
  const info = settingInfoMap[setting.key];
  const label = info?.label || setting.key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  const description = info?.description || setting.description;
  
  return { label, description };
};

export function Settings({ onBack }: { onBack?: () => void } = {}) {
  const [activeSection, setActiveSection] = useState("guardian");
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [formData, setFormData] = useState<SettingsFormData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [exportingDatabase, setExportingDatabase] = useState(false);
  const [importingDatabase, setImportingDatabase] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [versionInfo, setVersionInfo] = useState<{
    version: string;
    name: string;
    databaseVersion: string;
    codeVersion: string;
    isVersionMismatch: boolean;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    currentVersion: string;
    updateUrl: string;
  } | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchVersionInfo();
  }, []);

  // Check for updates when version info is available and AUTO_CHECK_UPDATES is enabled
  useEffect(() => {
    if (versionInfo?.version && settings.length > 0) {
      const autoCheckSetting = settings.find(setting => setting.key === 'AUTO_CHECK_UPDATES');
      const shouldAutoCheck = autoCheckSetting?.value === 'true';
      
      if (shouldAutoCheck) {
        checkForUpdatesQuietly();
      }
    }
  }, [versionInfo?.version, settings]);

  const checkForUpdatesQuietly = async () => {
    if (!versionInfo?.version) return;
    
    try {
      // Fetch latest release from GitHub API
      const response = await fetch('https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest');
      if (!response.ok) {
        console.warn('Failed to check for updates:', response.status);
        return;
      }
      
      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      const currentVersion = versionInfo.version;
      
      // Compare versions
      const hasUpdate = isVersionNewer(latestVersion, currentVersion);
      
      if (hasUpdate) {
        setUpdateInfo({
          hasUpdate: true,
          latestVersion,
          currentVersion,
          updateUrl: release.html_url,
        });
      }
    } catch (error) {
      console.error('Failed to check for updates quietly:', error);
    }
  };

  const fetchVersionInfo = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/config/version`);
      if (response.ok) {
        const data = await response.json();
        setVersionInfo(data);
      }
    } catch (error) {
      console.error("Failed to fetch version info:", error);
    }
  };

  const checkForUpdates = async () => {
    if (!versionInfo?.version) return;
    
    setCheckingUpdates(true);
    try {
      // Fetch latest release from GitHub API
      const response = await fetch('https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest');
      if (!response.ok) {
        console.warn('Failed to check for updates:', response.status);
        toast({
          title: "Update check failed",
          description: "Unable to check for updates. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      const currentVersion = versionInfo.version;
      
      // Compare versions
      const hasUpdate = isVersionNewer(latestVersion, currentVersion);
      
      if (hasUpdate) {
        setUpdateInfo({
          hasUpdate: true,
          latestVersion,
          currentVersion,
          updateUrl: release.html_url,
        });
      } else {
        // Clear any existing update info and show toast for latest version
        setUpdateInfo(null);
        toast({
          title: "You're up to date!",
          description: `Guardian v${currentVersion} is the latest version.`,
          variant: "success",
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast({
        title: "Update check failed",
        description: "Unable to check for updates. Please check your internet connection.",
        variant: "destructive",
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const isVersionNewer = (newVersion: string, currentVersion: string): boolean => {
    const parseVersion = (version: string) => {
      return version.split('.').map(v => parseInt(v) || 0);
    };

    const newV = parseVersion(newVersion);
    const currentV = parseVersion(currentVersion);

    for (let i = 0; i < Math.max(newV.length, currentV.length); i++) {
      const newPart = newV[i] || 0;
      const currentPart = currentV[i] || 0;
      
      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }
    
    return false; // versions are equal
  };

  const fetchSettings = async () => {
    setBackendError(null);
    try {
      const response = await fetch(`${config.api.baseUrl}/config`);
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
        case 'DEVICE_CLEANUP_INTERVAL_DAYS':
          const cleanupDays = Number(setting.value);
          if (isNaN(cleanupDays)) {
            errors.push('Device cleanup interval must be a number');
          } else if (!Number.isInteger(cleanupDays)) {
            errors.push('Device cleanup interval must be a whole number (no decimals)');
          } else if (cleanupDays < 1) {
            errors.push('Device cleanup interval must be at least 1 day');
          }
          break;
        case 'DEFAULT_PAGE':
          const validPages = ['devices', 'streams'];
          if (!validPages.includes(String(setting.value))) {
            errors.push('Default page must be either "devices" or "streams"');
          }
          break;
        case 'AUTO_CHECK_UPDATES':
          if (typeof setting.value !== 'boolean') {
            errors.push('Auto check updates must be a boolean value');
          }
          break;
          default:
            console.warn(`No validation rules for setting: ${setting.key}`);
            break;
      }
    }
    
    return errors;
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

      const response = await fetch(`${config.api.baseUrl}/config`, {
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

        // Clear connection status after saving settings
        setConnectionStatus(null);
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
    // Check if there are pending Plex settings changes
    if (hasPlexChanges()) {
      toast({
        title: "Pending Changes Detected",
        description: "Please save your Plex settings before testing the connection to ensure accurate results.",
        variant: "warning",
      });
      return;
    }

    setTestingConnection(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/config/test-plex-connection`, {
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
      const response = await fetch(`${config.api.baseUrl}/config/database/export`);
      
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
      // Read and validate the file
      const fileContent = await file.text();
      let importData;
      
      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        toast({
          title: "Invalid file",
          description: "The selected file is not a valid JSON file",
          variant: "destructive",
        });
        return;
      }

      // Check version compatibility
      const importVersion = importData.version;
      const currentVersion = versionInfo?.version;
      
      if (importVersion && currentVersion && importVersion !== currentVersion) {
        const shouldContinue = window.confirm(
          `Version mismatch detected! Please make sure you have a backup before proceeding.\n\n` +
          `Current version: ${currentVersion}\n` +
          `Import file version: ${importVersion}\n\n` +
          `You may lose data or break your installation. Do you want to continue with the import?`
        );
        
        if (!shouldContinue) {
          toast({
            title: "Import cancelled",
            description: "Import was cancelled due to version mismatch",
            variant: "default",
          });
          return;
        }
      }
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${config.api.baseUrl}/config/database/import`, {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        const successMessage = `Successfully imported ${result.imported.imported} items, ${result.imported.skipped} items skipped`;
        const versionMessage = importVersion && currentVersion !== importVersion ? ` (Version: ${importVersion} → ${currentVersion})` : '';
        
        toast({
          title: "Import successful",
          description: successMessage + versionMessage,
          variant: "success",
        });
        
        // Refresh settings and version info after import
        await fetchSettings();
        await fetchVersionInfo();
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
        "DEFAULT_PAGE",
        "AUTO_CHECK_UPDATES",
      ],
    };

    return settings.filter(
      (setting) => categoryMap[category]?.includes(setting.key) || false
    );
  };

  const renderSettingField = (setting: AppSetting) => {
    const value = formData[setting.key];
    const { label, description } = getSettingInfo(setting);

    if (setting.type === "boolean") {
      return (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{label}</Label>
            <p className="text-xs text-muted-foreground">
              {description}
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

    // Special handling for DEFAULT_PAGE setting
    if (setting.key === "DEFAULT_PAGE") {
      const options = [
        { value: "devices", label: "Device Management", icon: Shield },
        { value: "streams", label: "Active Streams", icon: Activity }
      ];
      
      return (
        <div className="space-y-2">
          <Label>{label}</Label>
          <div className="relative">
            <select
              value={String(value || "devices")}
              onChange={(e) => handleInputChange(setting.key, e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
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
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    );
  };

  const renderDeviceCleanupSettings = () => {
    const cleanupEnabledSetting = settings.find((s) => s.key === "DEVICE_CLEANUP_ENABLED");
    const cleanupIntervalSetting = settings.find((s) => s.key === "DEVICE_CLEANUP_INTERVAL_DAYS");

    if (!cleanupEnabledSetting || !cleanupIntervalSetting) return null;

    const isCleanupEnabled = Boolean(formData["DEVICE_CLEANUP_ENABLED"]);
    const { label: enabledLabel, description: enabledDescription } = getSettingInfo(cleanupEnabledSetting);
    const { label: intervalLabel, description: intervalDescription } = getSettingInfo(cleanupIntervalSetting);

    return (
      <Card className="p-4">
        <div className="space-y-4">
          {/* Device Cleanup Enabled Setting */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{enabledLabel}</Label>
              <p className="text-xs text-muted-foreground">
                {enabledDescription}
              </p>
            </div>
            <Switch
              checked={isCleanupEnabled}
              onCheckedChange={(checked) =>
                handleInputChange("DEVICE_CLEANUP_ENABLED", checked)
              }
              className="cursor-pointer"
            />
          </div>

          {/* Cleanup Interval Setting */}
          <div
            className={`ml-4 pl-4 border-l-2 ${isCleanupEnabled ? "border-border" : "border-muted"}`}
          >
            <div className="space-y-2">
              <Label className={!isCleanupEnabled ? "text-muted-foreground" : ""}>
                {intervalLabel}
              </Label>
              <Input
                type="number"
                min="1"
                max="365"
                step="1"
                value={String(formData["DEVICE_CLEANUP_INTERVAL_DAYS"] || "")}
                disabled={!isCleanupEnabled}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value, 10);
                  if (!isNaN(newValue) && newValue > 0) {
                    handleInputChange("DEVICE_CLEANUP_INTERVAL_DAYS", newValue);
                  } else if (e.target.value === "") {
                    handleInputChange("DEVICE_CLEANUP_INTERVAL_DAYS", "");
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent decimal input
                  if (e.key === '.' || e.key === ',') {
                    e.preventDefault();
                  }
                }}
                className={!isCleanupEnabled ? "bg-muted" : ""}
              />
              <p
                className={`text-xs ${!isCleanupEnabled ? "text-muted-foreground/60" : "text-muted-foreground"}`}
              >
                {intervalDescription}
              </p>
            </div>
          </div>
        </div>
      </Card>
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
                {hasPlexChanges() && (
                  <div className="flex items-center space-x-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      Save your Plex settings before testing the connection
                    </span>
                  </div>
                )}
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

              {/* Device Cleanup Settings Group */}
              {renderDeviceCleanupSettings()}
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
                      Download a backup of your Guardian database. This includes all settings, user devices, preferences, and active sessions.
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

  // Check if there are unsaved changes in Plex-related settings
  const hasPlexChanges = () => {
    const plexKeys = [
      "PLEX_TOKEN",
      "PLEX_SERVER_IP", 
      "PLEX_SERVER_PORT",
      "USE_SSL",
      "IGNORE_CERT_ERRORS"
    ];
    
    return Object.entries(formData).some(([key, value]) => {
      if (!plexKeys.includes(key)) return false;
      
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
    <div className="min-h-[calc(100vh-3.5rem)]">
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
            <Card className="border-red-600 bg-red-50 dark:border-red-700 dark:bg-red-950/20">
              <CardContent>
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-700 shrink-0" />
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
                    className="border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Version Mismatch Warning */}
        {versionInfo?.isVersionMismatch && (
          <div className="mb-6">
            <Card className="border-red-600 bg-red-50 dark:border-red-700 dark:bg-red-950/20">
              <CardContent>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-700 shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                      Version Mismatch Detected
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      Database version ({versionInfo.databaseVersion}) is newer than code version ({versionInfo.codeVersion}). 
                      Please update your Guardian installation to avoid compatibility issues.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchVersionInfo}
                    className="border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Update Available Banner */}
        {updateInfo?.hasUpdate && (
          <div className="mb-6">
            <Card className="border-blue-600 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20">
              <CardContent>
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-blue-600 dark:text-blue-700 shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                      Update Available
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      A new version of Guardian is available: v{updateInfo.latestVersion} 
                      (current: v{updateInfo.currentVersion}). Update to get the latest features and bug fixes.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                    variant="outline"
                      size="sm"
                      onClick={() => window.open(updateInfo.updateUrl, '_blank')}
                      className="border-blue-600 text-blue-600 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-700 dark:hover:bg-blue-900/20"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      See What's New
                    </Button>
                    {/* How to update */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <a href="https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#update-guardian" target="_blank" rel="noopener noreferrer" className="flex items-center">
                        <BookOpen className="h-4 w-4 mr-2" />
                        How to Update
                      </a>
                    </Button>
                  </div>
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
            
            {/* Version Information */}
            {versionInfo && (
              <div className="px-4 py-3 border-t border-border">
                <div className="text-xs text-muted-foreground space-y-2">
                  <div className="font-medium text-foreground">
                  {/* Update Check Button */}
                  <div className="pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={checkForUpdates}
                      disabled={checkingUpdates}
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {checkingUpdates ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Check for Updates
                    </Button>
                  </div>
                  </div>
                  {versionInfo.isVersionMismatch ? (
                    <>
                        <div className={versionInfo.databaseVersion < versionInfo.codeVersion ? "ml-2 text-red-600 dark:text-red-400" : "ml-2"}>
                        Database version: v{versionInfo.databaseVersion}
                        </div>
                        <div className={versionInfo.codeVersion < versionInfo.databaseVersion ? "ml-2 text-red-600 dark:text-red-400" : "ml-2"}>
                        App Version: v{versionInfo.codeVersion}
                        </div>
                    </>
                  ) : (
                    <>
                      <div className="ml-2">Database version {versionInfo.databaseVersion}</div>
                      <div className="ml-2">App Version {versionInfo.version}</div>
                    </>
                  )}
                
                </div>
              </div>
            )}
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
