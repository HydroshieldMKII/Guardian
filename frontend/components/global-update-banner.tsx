"use client";

import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { ReleaseNotesModal } from "@/components/ui/release-notes-modal";

export function GlobalUpdateBanner() {
  const { updateInfo } = useUpdateCheck();
  const [dismissed, setDismissed] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  if (!updateInfo?.hasUpdate || dismissed) {
    return null;
  }

  return (
    <>
      <div className="bg-blue-600 text-white border-b border-blue-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Update Available: v{updateInfo.latestVersion}
              </p>
              <p className="text-xs text-blue-100 break-words sm:truncate">
                A new version is available (current: v
                {updateInfo.currentVersion}). Update to get the latest features
                and bug fixes.
              </p>
            </div>

            <div className="flex items-center gap-2 sm:ml-4 self-start sm:self-center">
              <Button
                size="sm"
                onClick={() => setShowReleaseNotes(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1 h-auto"
              >
                See what&apos;s new
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  window.open(
                    "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating",
                    "_blank",
                  )
                }
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1 h-auto"
              >
                <Download className="h-3 w-3 mr-1" />
                How to update
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                className="text-white hover:bg-blue-700 p-1 h-auto"
                title="Hide this update notice"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ReleaseNotesModal
        isOpen={showReleaseNotes}
        onClose={() => setShowReleaseNotes(false)}
        latestVersion={updateInfo.latestVersion}
        currentVersion={updateInfo.currentVersion}
        releaseNotes={updateInfo.releaseNotes}
        updateUrl={updateInfo.updateUrl}
      />
    </>
  );
}
