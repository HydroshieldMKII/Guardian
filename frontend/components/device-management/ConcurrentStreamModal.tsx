"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  Meta,
  MetaGrid,
  Panel,
  ToggleRow,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Loader2 } from "lucide-react";
import { UserPreference } from "@/types";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";
import {
  INTEGER_RULES,
  integerError,
} from "@/components/settings/setting-validation";

const STREAM_LIMIT_RULE = INTEGER_RULES.CONCURRENT_STREAM_LIMIT;

interface ConcurrentStreamInfo {
  limit: number | null;
  effectiveLimit: number;
  isUnlimited: boolean;
  isOverridden: boolean;
}

interface ConcurrentStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username?: string;
  onUpdate?: (preference: Partial<UserPreference>) => void;
}

export const ConcurrentStreamModal: React.FC<ConcurrentStreamModalProps> = ({
  isOpen,
  onClose,
  userId,
  username,
  onUpdate,
}) => {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [useGlobalDefault, setUseGlobalDefault] = useState(true);
  const [customLimit, setCustomLimit] = useState<string>("0");

  const globalLimit = settings?.find(
    (s) => s.key === "CONCURRENT_STREAM_LIMIT",
  );
  const globalLimitValue = globalLimit ? Number(globalLimit.value) : 0;

  useEffect(() => {
    if (isOpen) {
      const fetchCurrentLimit = async () => {
        setFetching(true);
        try {
          const info =
            await apiClient.getUserConcurrentStreamInfo<ConcurrentStreamInfo>(
              userId,
            );
          const hasCustomLimit = info.isOverridden;
          setUseGlobalDefault(!hasCustomLimit);
          setCustomLimit(hasCustomLimit ? String(info.limit ?? 0) : "0");
        } catch (error) {
          console.error("Failed to fetch concurrent stream info:", error);
          setUseGlobalDefault(true);
          setCustomLimit("0");
        } finally {
          setFetching(false);
        }
      };
      void fetchCurrentLimit();
    }
  }, [isOpen, userId]);

  const limitError = useGlobalDefault
    ? null
    : integerError(customLimit, STREAM_LIMIT_RULE);

  const handleSave = async () => {
    if (limitError) return;
    setLoading(true);
    try {
      const newLimit = useGlobalDefault ? null : Number(customLimit);

      await apiClient.updateUserConcurrentStreamLimit(userId, newLimit);

      toast({
        title: "Stream limit updated",
        description: "The concurrent stream limit for this user has been saved",
        variant: "success",
      });

      if (onUpdate) {
        onUpdate({ concurrentStreamLimit: newLimit });
      }

      onClose();
    } catch (error) {
      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update the concurrent stream limit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const customLimitValue = Number(customLimit);
  const effectiveLimit =
    useGlobalDefault || limitError ? globalLimitValue : customLimitValue;

  const streamCount = (limit: number) =>
    limit === 0
      ? "Unlimited"
      : `${limit} concurrent stream${limit === 1 ? "" : "s"}`;

  const explanation = useGlobalDefault
    ? globalLimitValue === 0
      ? "The global limit is unlimited, so this user can run as many streams at once as they like. Change the global limit in Settings to affect every user."
      : "This user follows the global limit. Change the global limit in Settings to affect every user."
    : globalLimitValue === 0
      ? "The custom limit below applies to this user only. Every other user stays unlimited."
      : `The custom limit below applies to this user only, replacing the global limit of ${streamCount(globalLimitValue)}.`;

  const inactive = "opacity-45 transition-opacity duration-200";

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="md">
      <ModalHeader
        title="Concurrent stream limit"
        description={
          <>
            Set the maximum number of simultaneous streams for{" "}
            <span className="font-medium text-foreground">
              {username || userId}
            </span>
            .
          </>
        }
      />

      <ModalBody>
        {fetching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Panel className="space-y-3">
              <MetaGrid className="sm:grid-cols-2">
                <Meta
                  label="Global limit"
                  className={useGlobalDefault ? undefined : inactive}
                >
                  {streamCount(globalLimitValue)}
                </Meta>
                <Meta label="In effect for this user">
                  {streamCount(effectiveLimit)}
                </Meta>
              </MetaGrid>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {explanation}
              </p>
            </Panel>

            <ToggleRow
              id="use-global"
              label="Use global default"
              hint="Follow the global concurrent stream limit instead of setting one just for this user."
              checked={useGlobalDefault}
              onCheckedChange={setUseGlobalDefault}
            />

            <Field
              label="Custom limit for this user"
              htmlFor="custom-limit"
              hint="How many streams this user may run at once. Set it to 0 for unlimited."
              error={limitError}
              className={useGlobalDefault ? inactive : undefined}
            >
              <Input
                id="custom-limit"
                type="number"
                min={STREAM_LIMIT_RULE.min}
                max={STREAM_LIMIT_RULE.max}
                step={1}
                aria-invalid={Boolean(limitError)}
                value={customLimit}
                onChange={(e) => setCustomLimit(e.target.value)}
                disabled={useGlobalDefault}
                placeholder="0 = unlimited"
              />
            </Field>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={() => onClose()} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={loading || Boolean(limitError)}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
};
