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
import { Separator } from "@/components/ui/separator";
import {
  User,
  Bell,
  Palette,
  Shield,
  Server,
  Database,
  Key,
  Mail,
  Moon,
  Sun,
  Monitor,
  Volume2,
  Smartphone,
  AlertCircle,
  Save,
  RefreshCw,
} from "lucide-react";

const settingsSections = [
  {
    id: "profile",
    title: "Profile",
    description: "Manage your account profile and personal information",
    icon: User,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure notification preferences and alert settings",
    icon: Bell,
  },
  {
    id: "theme",
    title: "Theme & Appearance",
    description: "Customize the look and feel of your dashboard",
    icon: Palette,
  },
  {
    id: "rules",
    title: "Rules & Policies",
    description: "Set up automated rules and access policies",
    icon: Shield,
  },
  {
    id: "integration",
    title: "Plex Integration",
    description: "Configure Plex server connection and settings",
    icon: Server,
  },
  {
    id: "database",
    title: "Database",
    description: "Manage database connections and backup settings",
    icon: Database,
  },
];

export function Settings() {
  const [activeSection, setActiveSection] = useState("profile");

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Personal Information</h3>
              <p className="text-sm text-muted-foreground">
                Update your profile details and preferences.
              </p>
            </div>
            <div className="grid gap-6">
              <Card className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Profile Picture</h4>
                    <p className="text-xs text-muted-foreground">
                      Upload a new profile picture
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    Upload
                  </Button>
                </div>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Display Name</label>
                    <div className="h-8 bg-muted rounded border flex items-center px-3 text-sm text-muted-foreground">
                      Administrator
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <div className="h-8 bg-muted rounded border flex items-center px-3 text-sm text-muted-foreground">
                      admin@guardian.local
                    </div>
                  </div>
                </Card>
              </div>
            </div>
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
            <div className="space-y-4">
              {[
                {
                  icon: Mail,
                  title: "Email Notifications",
                  description: "Receive alerts via email",
                },
                {
                  icon: Smartphone,
                  title: "Push Notifications",
                  description: "Browser push notifications",
                },
              ].map((item) => (
                <Card key={item.title} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h4 className="text-sm font-medium">{item.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="w-10 h-6 bg-muted rounded-full relative">
                      <div className="w-4 h-4 bg-background rounded-full absolute top-1 left-1 shadow-sm transition-transform"></div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      case "theme":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Theme & Appearance</h3>
              <p className="text-sm text-muted-foreground">
                Customize the visual appearance of your dashboard.
              </p>
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Theme Mode</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: Sun, label: "Light", active: false },
                      { icon: Moon, label: "Dark", active: true },
                      { icon: Monitor, label: "System", active: false },
                    ].map((theme) => (
                      <div
                        key={theme.label}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          theme.active
                            ? "border-primary bg-primary/5"
                            : "border-muted"
                        }`}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <theme.icon className="h-5 w-5" />
                          <span className="text-xs font-medium">
                            {theme.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Color Scheme</h4>
                  <div className="grid grid-cols-6 gap-2">
                    {["blue", "green", "purple", "orange", "red", "pink"].map(
                      (color) => (
                        <div
                          key={color}
                          className={`w-10 h-10 rounded-full cursor-pointer ring-2 ring-offset-2 ${
                            color === "blue"
                              ? "ring-primary"
                              : "ring-transparent"
                          }`}
                          style={{ backgroundColor: `var(--${color}-500)` }}
                        />
                      )
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );

      case "rules":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Rules & Policies</h3>
              <p className="text-sm text-muted-foreground">
                Configure automated rules and access control policies.
              </p>
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Access Control</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">
                        Auto-approve trusted devices
                      </span>
                      <div className="w-10 h-6 bg-primary rounded-full relative">
                        <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">
                        Require admin approval for new devices
                      </span>
                      <div className="w-10 h-6 bg-primary rounded-full relative">
                        <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Stream Limits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Max concurrent streams
                      </label>
                      <div className="h-8 bg-muted rounded border flex items-center px-3 text-sm text-muted-foreground">
                        5
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Session timeout (minutes)
                      </label>
                      <div className="h-8 bg-muted rounded border flex items-center px-3 text-sm text-muted-foreground">
                        30
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );

      case "integration":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Plex Integration</h3>
              <p className="text-sm text-muted-foreground">
                Configure your Plex server connection and integration settings.
              </p>
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Server Connection</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Server URL</label>
                      <div className="h-8 bg-muted rounded border flex items-center px-3 text-sm text-muted-foreground">
                        http://localhost:32400
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Connection Status
                      </label>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-600">
                          Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Authentication</h4>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Plex Token</label>
                    <div className="h-8 bg-muted rounded border flex items-center px-3 text-sm text-muted-foreground">
                      ••••••••••••••••••••
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <Key className="w-4 h-4 mr-2" />
                    Update Token
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        );

      case "database":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Database Settings</h3>
              <p className="text-sm text-muted-foreground">
                Manage database connections, backups, and maintenance.
              </p>
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Backup & Maintenance</h4>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Database className="w-4 h-4 mr-2" />
                      Create Backup
                    </Button>
                    <Button size="sm" variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Optimize Database
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
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

              {/* Save Button */}
              <Separator className="my-6" />
              <div className="flex justify-end space-x-2">
                <Button variant="outline">Cancel</Button>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
