"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { parseReleaseNotes, type Inline } from "@/lib/release-notes";

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestVersion: string;
  currentVersion?: string;
  releaseNotes: string;
  updateUrl: string;
}

const UPDATE_GUIDE_URL =
  "https://github.com/HydroshieldMKII/Guardian?tab=readme-ov-file#updating";

function InlineText({ parts }: { parts: Inline[] }) {
  return parts.map((part, index) => {
    switch (part.type) {
      case "strong":
        return (
          <strong key={index} className="font-semibold text-foreground">
            {part.value}
          </strong>
        );
      case "code":
        return (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
          >
            {part.value}
          </code>
        );
      case "link":
        return (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="tabular text-muted-foreground underline decoration-border underline-offset-[3px] transition-colors hover:text-foreground hover:decoration-current"
          >
            {part.label}
          </a>
        );
      default:
        return <React.Fragment key={index}>{part.value}</React.Fragment>;
    }
  });
}

function ReleaseNotes({ notes }: { notes: string }) {
  const blocks = parseReleaseNotes(notes);
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No release notes available.
      </p>
    );
  }

  return (
    <div className="text-sm leading-relaxed text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3
              key={index}
              className="mt-6 mb-2 text-[13px] font-semibold text-muted-foreground first:mt-0"
            >
              <InlineText parts={block.content} />
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="relative pl-4 before:absolute before:top-[0.6875rem] before:left-0.5 before:size-1 before:rounded-full before:bg-muted-foreground/50"
                >
                  <InlineText parts={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="mt-4 text-muted-foreground first:mt-0">
            <InlineText parts={block.content} />
          </p>
        );
      })}
    </div>
  );
}

export function ReleaseNotesModal({
  isOpen,
  onClose,
  latestVersion,
  currentVersion,
  releaseNotes,
  updateUrl,
}: ReleaseNotesModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={onClose} size="lg">
      <ModalHeader
        title={`What's New in v${latestVersion}`}
        description={
          currentVersion ? `You're on v${currentVersion}` : undefined
        }
      />

      <ModalBody>
        <ReleaseNotes notes={releaseNotes} />
      </ModalBody>

      <ModalFooter>
        <Button
          variant="ghost"
          onClick={() => onClose()}
          className="sm:mr-auto"
        >
          Close
        </Button>
        <Button
          variant="outline"
          onClick={() => window.open(UPDATE_GUIDE_URL, "_blank")}
        >
          How to update
        </Button>
        <Button onClick={() => window.open(updateUrl, "_blank")}>
          View on GitHub
        </Button>
      </ModalFooter>
    </Modal>
  );
}
