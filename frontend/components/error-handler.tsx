"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlexStatus } from "@/types";
import {
  PlexErrorCode,
  ERROR_DISPLAY_CONFIG,
  ErrorDisplayConfig,
} from "@/types/plex-errors";

interface ErrorHandlerProps {
  plexStatus?: PlexStatus | null;
  backendError?: string | null;
  onShowSettings?: () => void;
  onRetry?: () => void;
}

export function ErrorHandler({
  plexStatus,
  backendError,
  onShowSettings,
  onRetry,
}: ErrorHandlerProps) {
  const withDetail = (config: ErrorDisplayConfig, detail: string) =>
    detail
      ? { ...config, description: `${config.description} (${detail})` }
      : { ...config };

  // Determine the appropriate display configuration based on the error
  const getErrorInfo = () => {
    // Check for backend errors FIRST
    if (backendError) {
      return {
        title: "Cannot Reach Guardian",
        description: backendError,
        showChecklist: false,
        isBackendError: true,
      };
    }

    // Check for plex connection errors
    const status = plexStatus?.connectionStatus || "";

    if (
      status.includes("Backend connection error") ||
      status.includes("Failed to fetch dashboard data") ||
      status.includes("Cannot connect to Guardian backend") ||
      status.includes("Backend server is not reachable")
    ) {
      return {
        title: "Cannot Reach Guardian",
        description:
          "Guardian's own server is not answering. Check that the Guardian service is running.",
        showChecklist: false,
      };
    }

    // Check if not configured (only if it's not a backend error)
    if (!plexStatus?.configured) {
      return { ...ERROR_DISPLAY_CONFIG[PlexErrorCode.NOT_CONFIGURED] };
    }

    let errorCode: PlexErrorCode | null = null;

    // Check for the specific error codes from backend
    if (status.startsWith("PLEX_CONNECTION_REFUSED:")) {
      errorCode = PlexErrorCode.CONNECTION_REFUSED;
    } else if (status.startsWith("PLEX_CONNECTION_TIMEOUT:")) {
      errorCode = PlexErrorCode.CONNECTION_TIMEOUT;
    } else if (
      status.startsWith("PLEX_AUTH_FAILED:") ||
      status.startsWith("PLEX_UNAUTHORIZED:")
    ) {
      errorCode = PlexErrorCode.AUTH_FAILED;
    } else if (
      status.startsWith("PLEX_SSL_ERROR:") ||
      status.startsWith("PLEX_CERT_ERROR:")
    ) {
      errorCode = status.startsWith("PLEX_CERT_ERROR:")
        ? PlexErrorCode.CERT_ERROR
        : PlexErrorCode.SSL_ERROR;
    } else if (status.startsWith("PLEX_SERVER_ERROR:")) {
      errorCode = PlexErrorCode.SERVER_ERROR;
    } else if (status.startsWith("PLEX_NETWORK_ERROR:")) {
      errorCode = PlexErrorCode.NETWORK_ERROR;
    } else if (status.startsWith("PLEX_UNKNOWN_ERROR:")) {
      errorCode = PlexErrorCode.UNKNOWN_ERROR;
    }

    // If we found an error code, use the configured display
    if (errorCode && ERROR_DISPLAY_CONFIG[errorCode]) {
      return withDetail(
        ERROR_DISPLAY_CONFIG[errorCode],
        status.slice(status.indexOf(":") + 1).trim(),
      );
    }

    // Fallback for unknown errors
    return withDetail(
      {
        title: "Something Went Wrong",
        description:
          "Guardian ran into a problem it could not explain. Check your setup and try again.",
        showChecklist: false,
      },
      status,
    );
  };

  const errorInfo = getErrorInfo();

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-2xl">
            <CardHeader className="pb-2 mt-8">
              <CardTitle className="text-2xl font-bold text-foreground">
                {errorInfo.title}
              </CardTitle>
              <CardDescription className="text-lg">
                {errorInfo.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {errorInfo.showChecklist && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground">
                    To get started, you'll need to configure:
                  </h4>
                  <ul className="space-y-2 list-disc list-inside">
                    <li className="text-sm text-muted-foreground">
                      Plex Server IP Address
                    </li>
                    <li className="text-sm text-muted-foreground">
                      Plex Server Port
                    </li>
                    <li className="text-sm text-muted-foreground">
                      Plex Authentication Token
                    </li>
                  </ul>
                </div>
              )}

              <div className="pt-4 mb-8">
                {errorInfo.isBackendError && onRetry ? (
                  <Button onClick={onRetry} className="w-full" size="lg">
                    Retry Connection
                  </Button>
                ) : (
                  onShowSettings && (
                    <Button
                      onClick={onShowSettings}
                      className="w-full"
                      size="lg"
                    >
                      Go to settings
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Backward compatibility alias
export const PlexErrorHandler = ErrorHandler;
