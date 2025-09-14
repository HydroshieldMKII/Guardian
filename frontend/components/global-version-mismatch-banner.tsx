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
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Critical Version Mismatch Detected
              </p>
              <p className="text-xs text-red-100 truncate">
                Database version ({versionInfo.databaseVersion}) is newer than code version ({versionInfo.codeVersion}). 
                Update Guardian immediately to prevent data corruption.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
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