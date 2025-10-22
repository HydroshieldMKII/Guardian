"use client";

import { Download, NotepadText, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { useVersion } from "@/contexts/version-context";
import { ReleaseNotesModal } from "@/components/ui/release-notes-modal";

export function GlobalUpdateBanner() {
  const { updateInfo, checkForUpdatesManually, clearUpdateInfo } = useVersion();
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  const handleCheckAgain = useCallback(async () => {
    if (checking) return; // Prevent multiple simultaneous checks

    setChecking(true);
    try {
      await checkForUpdatesManually();
    } catch (error) {
      console.error("Error checking for updates:", error);
    } finally {
      setChecking(false);
    }
  }, [checking, checkForUpdatesManually]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    clearUpdateInfo();
  }, [clearUpdateInfo]);

  // Don't show if no update available, no update info, or dismissed
  if (!updateInfo?.hasUpdate || dismissed) {
    return null;
  }

  return (
    <>
      <div className="bg-blue-600 text-white border-b border-blue-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
              <Download className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Update Available: Guardian v{updateInfo.latestVersion}
                </p>
                <p className="text-xs text-blue-100 break-words sm:truncate">
                  A new version is available (current: v
                  {updateInfo.currentVersion}). Update to get the latest
                  features and bug fixes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:ml-4 self-start sm:self-center">
              {/* <Button
                variant="ghost"
                size="sm"
                onClick={handleCheckAgain}
                disabled={checking}
                className="text-white bg-blue-700 hover:bg-blue-700 text-xs px-2 py-1 h-auto"
              >
                {checking ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Check Again
              </Button> */}
              <Button
                size="sm"
                onClick={() => setShowReleaseNotes(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1 h-auto"
              >
                <NotepadText className="h-3 w-3 mr-1" />
                See what's new
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  window.open(
                    "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating",
                    "_blank"
                  )
                }
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1 h-auto"
              >
                <Download className="h-3 w-3 mr-1" />
                How to Update
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-white hover:bg-blue-700 p-1 h-auto"
                title="Dismiss"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {updateInfo && (
        <ReleaseNotesModal
          isOpen={showReleaseNotes}
          onClose={() => setShowReleaseNotes(false)}
          latestVersion={updateInfo.latestVersion}
          releaseNotes={updateInfo.releaseNotes || ""}
          updateUrl={updateInfo.updateUrl}
        />
      )}
    </>
  );
}
