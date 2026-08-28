"use client";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

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
          '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>',
        )
        .replace(
          /^## (.*$)/gm,
          '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>',
        )
        .replace(
          /^# (.*$)/gm,
          '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>',
        )
        // Convert markdown lists
        .replace(/^\* (.*$)/gm, '<li class="ml-4 mb-1 list-disc">$1</li>')
        .replace(/^- (.*$)/gm, '<li class="ml-4 mb-1 list-disc">$1</li>')
        // Wrap consecutive list items in ul tags
        .replace(
          /(<li[^>]*>[\s\S]*?<\/li>(?:\s*<li[^>]*>[\s\S]*?<\/li>)*)/g,
          '<ul class="ml-4 mb-2">$1</ul>',
        )
        // Convert markdown bold
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        // Convert markdown links
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1 <ExternalLink class="inline h-3 w-3" /></a>',
        )
        // Convert line breaks
        .replace(/\n/g, "<br />")
    );
  };

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="lg">
      <ModalHeader
        title={`What's New in v${latestVersion}`}
        description="Review the latest features and improvements in this release."
      />

      <ModalBody>
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: formatReleaseNotes(releaseNotes),
          }}
        />
      </ModalBody>

      <ModalFooter className="sm:justify-stretch">
        <Button
          variant="outline"
          onClick={() => onClose()}
          className="sm:flex-1"
        >
          Close
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating",
              "_blank",
            )
          }
          className="sm:flex-1"
        >
          How to Update
        </Button>
        <Button
          onClick={() => window.open(updateUrl, "_blank")}
          className="sm:flex-1"
        >
          View on Github
        </Button>
      </ModalFooter>
    </Modal>
  );
}
