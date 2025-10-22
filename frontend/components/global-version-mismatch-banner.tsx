"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useVersion } from "@/contexts/version-context";

export function GlobalVersionMismatchBanner() {
  const { versionInfo, refreshVersionInfo } = useVersion();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if no version mismatch, no version info, or dismissed
  if (!versionInfo?.isVersionMismatch || dismissed) {
    return null;
  }

  return (
    <div className="bg-red-600 text-white border-b border-red-700">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Critical Version Mismatch Detected
              </p>
              <p className="text-xs text-red-100 break-words sm:truncate">
                Database version ({versionInfo.databaseVersion}) is newer than
                code version ({versionInfo.codeVersion}). Unexpected issues may
                occur, please update the application right away.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-4 self-start sm:self-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshVersionInfo}
              className="text-white hover:bg-red-700 text-xs px-2 py-1 h-auto"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="text-white hover:bg-red-700 p-1 h-auto"
              title="Dismiss (until page reload)"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
