import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { useNewTimeRule } from "@/hooks/device-management/useNewTimeRule";
import { useTimeRuleBulkActions } from "@/hooks/device-management/useTimeRuleBulkActions";
import { useTimeRuleEditing } from "@/hooks/device-management/useTimeRuleEditing";
import { useTimeRuleFeedback } from "@/hooks/device-management/useTimeRuleFeedback";
import { useTimeRules } from "@/hooks/device-management/useTimeRules";
import { NewTimeRuleForm } from "@/components/device-management/NewTimeRuleForm";
import { TimeRulePresets } from "@/components/device-management/TimeRulePresets";
import { ActiveRulesSection } from "./time-rules/ActiveRulesSection";
import { TimeRuleConfirmations } from "./time-rules/TimeRuleConfirmations";

interface TimeRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  deviceIdentifier?: string;
}

export function TimeRuleModal({
  isOpen,
  onClose,
  userId,
  username,
  deviceIdentifier,
}: TimeRuleModalProps) {
  const {
    rules,
    isLoading,
    isError,
    createTimeRule,
    updateTimeRule,
    deleteTimeRule,
    deleteTimeRules,
    applyPreset,
  } = useTimeRules(userId, deviceIdentifier, isOpen);
  const feedback = useTimeRuleFeedback(isError);
  const editing = useTimeRuleEditing({
    rules,
    updateTimeRule,
    deleteTimeRule,
    feedback,
  });
  const newRule = useNewTimeRule({
    rules,
    deviceIdentifier,
    createTimeRule,
    feedback,
  });
  const bulk = useTimeRuleBulkActions({
    rules,
    deleteTimeRules,
    applyPreset,
    feedback,
  });

  return (
    <>
      <Modal open={isOpen} onOpenChange={onClose} size="xl">
        <ModalHeader
          title="Time schedule"
          description={
            <>
              <span className="font-medium text-foreground">{username}</span>{" "}
              can stream at any time unless a rule below says otherwise. Each
              rule blocks streaming on one day, between the two times you set.
            </>
          }
        />

        <ModalBody className="space-y-0">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
            <ActiveRulesSection
              rules={rules}
              loading={isLoading}
              deletingAll={bulk.deletingAll}
              onDeleteAll={bulk.requestDeleteAll}
              editing={editing}
            />

            <Section
              className="order-2 lg:sticky lg:top-0 lg:w-1/2 lg:self-start"
              title="Add a rule"
            >
              <TimeRulePresets
                applying={bulk.applyingPreset}
                disabled={!!bulk.applyingPreset || newRule.creating}
                onChoose={bulk.choosePreset}
              />

              <NewTimeRuleForm
                value={newRule.rule}
                creating={newRule.creating}
                disabled={!!bulk.applyingPreset}
                onChange={newRule.change}
                onSubmit={() => void newRule.create()}
              />
            </Section>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <TimeRuleConfirmations bulk={bulk} />
    </>
  );
}
