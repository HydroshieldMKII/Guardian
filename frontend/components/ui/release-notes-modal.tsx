"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestVersion: string;
  releaseNotes: string;
  updateUrl: string;
}

export function ReleaseNotesModal({
  isOpen,
  onClose,
  latestVersion,
  releaseNotes,
  updateUrl,
}: ReleaseNotesModalProps) {
  // Format markdown-like text to HTML
  const formatReleaseNotes = (notes: string) => {
    if (!notes) return "No release notes available.";

    return (
      notes
        // Convert markdown headers
        .replace(
          /^### (.*$)/gm,
          '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>'
        )
        .replace(
          /^## (.*$)/gm,
          '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>'
        )
        .replace(
          /^# (.*$)/gm,
          '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>'
        )
        // Convert markdown lists
        .replace(/^\* (.*$)/gm, '<li class="ml-4 mb-1 list-disc">$1</li>')
        .replace(/^- (.*$)/gm, '<li class="ml-4 mb-1 list-disc">$1</li>')
        // Wrap consecutive list items in ul tags
        .replace(/(<li[^>]*>.*?<\/li>(?:\s*<li[^>]*>.*?<\/li>)*)/gs, '<ul class="ml-4 mb-2">$1</ul>')
        // Convert markdown bold
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        // Convert markdown links
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1 <ExternalLink class="inline h-3 w-3" /></a>'
        )
        // Convert line breaks
        .replace(/\n/g, "<br />")
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            What&apos;s New in Guardian v{latestVersion}
          </DialogTitle>
          <DialogDescription>
            Review the latest features and improvements in this release.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: formatReleaseNotes(releaseNotes),
            }}
          />
        </ScrollArea>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={() => window.open(updateUrl, "_blank")}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View on Github
          </Button>
          <Button
            onClick={() =>
              window.open(
                "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating",
                "_blank"
              )
            }
            variant="outline"
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            How to Update
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
