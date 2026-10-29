import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Panel, StatusPill } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { DeviceIcon } from "@/components/portal/DeviceIcon";
import type { PortalDevice } from "@/types";

export const NOTE_MAX_LENGTH = 500;

function DeviceSummary({ device }: { device: PortalDevice }) {
  return (
    <Panel className="flex items-center gap-3 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <DeviceIcon platform={device.devicePlatform} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {device.deviceName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {device.deviceProduct} · {device.devicePlatform}
        </p>
      </div>
    </Panel>
  );
}

export function NoteRequestDialogs({
  device,
  open,
  submitting,
  onClose,
  onSubmit,
}: {
  device: PortalDevice;
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (description: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [description, setDescription] = useState(
    device.requestDescription ?? "",
  );

  return (
    <>
      <Modal
        open={open && !confirming}
        onOpenChange={(next) => !next && onClose()}
      >
        <ModalHeader
          title="Send a note to the server owner"
          description="Tell the server owner why you need access on this device. They see your note next to the device when they review it."
        />
        <ModalBody>
          <DeviceSummary device={device} />
          <Field
            label="Note"
            htmlFor="request-note"
            action={<StatusPill tone="neutral">Optional</StatusPill>}
          >
            <Textarea
              id="request-note"
              placeholder="This is my living room TV"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              rows={4}
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {description.length}/{NOTE_MAX_LENGTH}
            </p>
          </Field>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => setConfirming(true)}>Continue</Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={open && confirming}
        onOpenChange={(next) => !next && onClose()}
      >
        <ModalHeader
          title="Confirm submission"
          description="You can only submit a note once per device. After submission, you will not be able to modify or add another note for this device."
        />
        <ModalBody>
          <DeviceSummary device={device} />
          {description ? (
            <div className="rounded-lg bg-muted/70 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                Your note
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                {description}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No note provided. You can go back to add one.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setConfirming(false)}
            disabled={submitting}
          >
            Go back
          </Button>
          <Button onClick={() => onSubmit(description)} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit note"
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
