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
import { PlexErrorCode, ERROR_DISPLAY_CONFIG } from "@/types/plex-errors";

interface PlexErrorHandlerProps {
  plexStatus: PlexStatus | null;
  onShowSettings: () => void;
}

// Icon mapping for display config
const ICON_MAP = {
  Server,
  Settings,
  WifiOff,
  Shield,
  AlertTriangle,
};

export function PlexErrorHandler({ plexStatus, onShowSettings }: PlexErrorHandlerProps) {
  // Determine the appropriate display configuration based on the error
  const getErrorInfo = () => {
    // Check if not configured first
    if (!plexStatus?.configured) {
      const config = ERROR_DISPLAY_CONFIG[PlexErrorCode.NOT_CONFIGURED];
      return {
        ...config,
        icon: ICON_MAP[config.iconName as keyof typeof ICON_MAP]
      };
    }

    // Try to extract errorCode from connectionStatus
    const status = plexStatus?.connectionStatus || "";
    
    // The status now contains "ERRORCODE: message" format from backend
    // Parse the error code from the beginning of the status string
    let errorCode: PlexErrorCode | null = null;
    
    // Check for the specific error codes that our backend now returns
    if (status.startsWith("PLEX_CONNECTION_REFUSED:")) {
      errorCode = PlexErrorCode.CONNECTION_REFUSED;
    } else if (status.startsWith("PLEX_CONNECTION_TIMEOUT:")) {
      errorCode = PlexErrorCode.CONNECTION_TIMEOUT;
    } else if (status.startsWith("PLEX_AUTH_FAILED:") || status.startsWith("PLEX_UNAUTHORIZED:")) {
      errorCode = PlexErrorCode.AUTH_FAILED;
    } else if (status.startsWith("PLEX_SSL_ERROR:") || status.startsWith("PLEX_CERT_ERROR:")) {
      errorCode = status.startsWith("PLEX_CERT_ERROR:") ? PlexErrorCode.CERT_ERROR : PlexErrorCode.SSL_ERROR;
    } else if (status.startsWith("PLEX_SERVER_ERROR:")) {
      errorCode = PlexErrorCode.SERVER_ERROR;
    } else if (status.startsWith("PLEX_NETWORK_ERROR:")) {
      errorCode = PlexErrorCode.NETWORK_ERROR;
    } else if (status.startsWith("PLEX_UNKNOWN_ERROR:")) {
      errorCode = PlexErrorCode.UNKNOWN_ERROR;
    } else if (status.includes("Backend connection error")) {
      return {
        title: "Backend Connection Error",
        description: "Cannot communicate with the Guardian backend. Please check if the backend service is running.",
        icon: AlertTriangle,
        iconColor: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-100 dark:bg-red-900/20",
        showChecklist: false
      };
    }

    // If we found an error code, use the configured display
    if (errorCode && ERROR_DISPLAY_CONFIG[errorCode]) {
      const config = ERROR_DISPLAY_CONFIG[errorCode];
      return {
        ...config,
        icon: ICON_MAP[config.iconName as keyof typeof ICON_MAP]
      };
    }

    // Fallback for unknown errors
    return {
      title: "Oops! Something Went Wrong",
      description: "Something went wrong with Guardian. Please check your setup and try again.",
      icon: Server,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-900/20",
      showChecklist: false
    };
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