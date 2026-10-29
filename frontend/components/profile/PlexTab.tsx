"use client";

import { Loader2, Unlink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { PlexLogo } from "@/components/ui/plex-logo";
import type { LinkedPlex } from "@/hooks/profile/useLinkedPlex";

function LinkedAccount({ plex }: { plex: LinkedPlex }) {
  const name = plex.account?.plexUsername || "Plex user";
  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            {plex.account?.plexThumb && (
              <AvatarImage src={plex.account.plexThumb} alt={name} />
            )}
            <AvatarFallback className="bg-[#e5a00d]">
              <PlexLogo className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name}</p>
            <p className="text-sm text-muted-foreground">Linked Plex account</p>
          </div>
        </div>
      </Card>

      <Button
        variant="destructive"
        onClick={() => void plex.unlink()}
        disabled={plex.unlinking}
        className="w-full"
      >
        {plex.unlinking ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Unlink className="mr-2 h-4 w-4" />
        )}
        Unlink Plex account
      </Button>
    </>
  );
}

function LinkAccount({ plex }: { plex: LinkedPlex }) {
  return (
    <>
      <Card className="p-4 border-dashed">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            No Plex account linked
          </p>
        </div>
      </Card>

      <Button
        onClick={() => void plex.link()}
        disabled={plex.linking}
        className="w-full bg-[#e5a00d] hover:bg-[#cc8f0c] text-black border-[#e5a00d] hover:border-[#cc8f0c]"
      >
        {plex.linking ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Waiting for Plex...
          </>
        ) : (
          <>
            <PlexLogo className="mr-2 h-4 w-4" />
            Link Plex account
          </>
        )}
      </Button>

      {plex.waiting && (
        <p className="text-center text-xs text-muted-foreground">
          Finish linking on the Plex window, or{" "}
          <button
            type="button"
            onClick={() => plex.cancelLink()}
            className="cursor-pointer underline underline-offset-2 hover:text-foreground"
          >
            cancel
          </button>
          .
        </p>
      )}
    </>
  );
}

export function PlexTab({
  plex,
  onClose,
}: {
  plex: LinkedPlex;
  onClose: () => void;
}) {
  return (
    <>
      <div className="space-y-4">
        {plex.account ? (
          <LinkedAccount plex={plex} />
        ) : (
          <LinkAccount plex={plex} />
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
