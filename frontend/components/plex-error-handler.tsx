"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Settings,
  Server,
  WifiOff,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { PlexStatus } from "@/types";

interface PlexErrorHandlerProps {
  plexStatus: PlexStatus | null;
  onShowSettings: () => void;
}

export function PlexErrorHandler({ plexStatus, onShowSettings }: PlexErrorHandlerProps) {
  // Determine the appropriate title, description, and icon based on the error
  const getErrorInfo = () => {
    const status = plexStatus?.connectionStatus || "Not configured";
    
    // Check for specific error types
    if (!plexStatus?.configured) {
      return {
        title: "Plex Configuration Required",
        description: "Guardian needs to connect to your Plex Media Server to monitor streams and manage devices.",
        icon: Server,
        iconColor: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-100 dark:bg-amber-900/20",
        showChecklist: true
      };
    } else if (status.includes("Connection refused") || status.includes("ECONNREFUSED")) {
      return {
        title: "Plex Server Unreachable",
        description: "Cannot connect to your Plex server. Please check if Plex is running and the network settings are correct.",
        icon: WifiOff,
        iconColor: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-100 dark:bg-red-900/20",
        showChecklist: false
      };
    } else if (status.includes("timeout") || status.includes("ECONNRESET")) {
      return {
        title: "Connection Timeout",
        description: "The connection to your Plex server is timing out. Please verify your IP address, port, and network settings.",
        icon: WifiOff,
        iconColor: "text-orange-600 dark:text-orange-400",
        iconBg: "bg-orange-100 dark:bg-orange-900/20",
        showChecklist: false
      };
    } else if (status.includes("SSL") || status.includes("TLS") || status.includes("certificate")) {
      return {
        title: "SSL Connection Issue",
        description: "There's an SSL/TLS certificate problem. Try disabling SSL or enabling 'Ignore SSL certificate errors' in settings.",
        icon: Shield,
        iconColor: "text-orange-600 dark:text-orange-400",
        iconBg: "bg-orange-100 dark:bg-orange-900/20",
        showChecklist: false
      };
    } else if (status.includes("401") || status.includes("Unauthorized")) {
      return {
        title: "Authentication Failed",
        description: "Your Plex authentication token is invalid or expired. Please update your Plex token in the settings.",
        icon: Shield,
        iconColor: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-100 dark:bg-red-900/20",
        showChecklist: false
      };
    } else if (status.includes("Failed to fetch")) {
      return {
        title: "Backend Connection Error",
        description: "Cannot communicate with the Guardian backend. Please check if the backend service is running.",
        icon: AlertTriangle,
        iconColor: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-100 dark:bg-red-900/20",
        showChecklist: false
      };
    } else {
      return {
        title: "Plex Connection Issue",
        description: "There's a problem connecting to your Plex server. Please check your configuration and try again.",
        icon: Server,
        iconColor: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-100 dark:bg-amber-900/20",
        showChecklist: false
      };
    }
  };

  const errorInfo = getErrorInfo();
  const IconComponent = errorInfo.icon;

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className={`p-3 rounded-full ${errorInfo.iconBg}`}>
                  <IconComponent className={`h-8 w-8 ${errorInfo.iconColor}`} />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                {errorInfo.title}
              </CardTitle>
              <CardDescription className="text-lg">
                {errorInfo.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-primary/10 dark:bg-primary/20 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {plexStatus?.configured ? (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-primary">
                      Connection Status
                    </h3>
                    <p className="text-sm text-primary/80">
                      {plexStatus?.connectionStatus || "Not configured"}
                    </p>
                  </div>
                </div>
              </div>

              {errorInfo.showChecklist && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground">
                    To get started, you'll need to configure:
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Plex Server IP Address
                      </span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Plex Server Port
                      </span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Plex Authentication Token
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              <div className="pt-4">
                <Button
                  onClick={onShowSettings}
                  className="w-full"
                  size="lg"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Plex Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}