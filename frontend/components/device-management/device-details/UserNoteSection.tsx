import { Button } from "@/components/ui/button";
import {
  Meta,
  MetaGrid,
  Panel,
  Section,
  toneButton,
} from "@/components/ui/entity";
import { localTime } from "./DeviceOverview";
import { Spinner } from "./Spinner";

export function UserNoteSection({
  description,
  submittedAt,
  readAt,
  deleting,
  onDelete,
}: {
  description: string;
  submittedAt: string;
  readAt: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <Section title="User note">
      <Panel>
        <p className="text-sm leading-relaxed text-foreground">{description}</p>
      </Panel>
      <MetaGrid className="sm:grid-cols-2">
        <Meta label="Submitted">{localTime(submittedAt)}</Meta>
        <Meta label="Read">{localTime(readAt)}</Meta>
      </MetaGrid>
      <div className="flex sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className={`w-full sm:w-auto ${toneButton("danger")}`}
        >
          {deleting && <Spinner />}
          Delete note
        </Button>
      </div>
    </Section>
  );
}
