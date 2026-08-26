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
import { useSettings } from "@/contexts/settings-context";

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

  // Get global concurrent stream limit from settings
  const globalLimit = settings?.find(
    (s) => s.key === "CONCURRENT_STREAM_LIMIT",
  );
  const globalLimitValue = globalLimit ? Number(globalLimit.value) : 0;

  // Fetch current settings when modal opens
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
          // Fall back to defaults
          setUseGlobalDefault(true);
          setCustomLimit("0");
        } finally {
          setFetching(false);
        }
      };
      fetchCurrentLimit();
    }
  }, [isOpen, userId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const newLimit = useGlobalDefault ? null : Number(customLimit);

      await apiClient.updateUserConcurrentStreamLimit(userId, newLimit);

      toast({
        title: "Success",
        description: "Concurrent stream limit updated successfully",
        variant: "success",
      });

      if (onUpdate) {
        onUpdate({ concurrentStreamLimit: newLimit });
      }

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update concurrent stream limit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const effectiveLimit = useGlobalDefault
    ? globalLimitValue
    : Number(customLimit);

  const streamCount = (limit: number) =>
    limit === 0
      ? "Unlimited"
      : `${limit} concurrent stream${limit === 1 ? "" : "s"}`;

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="md">
      <ModalHeader
        title="Concurrent Stream Limit"
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
            <Panel>
              <MetaGrid className="sm:grid-cols-2">
                <Meta label="Global limit">
                  {globalLimitValue === 0 ? "Unlimited" : globalLimitValue}
                </Meta>
                <Meta label="Effective limit">
                  {streamCount(effectiveLimit)}
                </Meta>
              </MetaGrid>
            </Panel>

            <ToggleRow
              id="use-global"
              label="Use global default"
              hint="Apply the global concurrent stream limit to this user."
              checked={useGlobalDefault}
              onCheckedChange={setUseGlobalDefault}
            />

            <Field
              label="Custom limit for this user"
              htmlFor="custom-limit"
              hint="Set to 0 for unlimited streams, or enter a specific limit."
              className={
                useGlobalDefault
                  ? "opacity-50 transition-opacity duration-200"
                  : "transition-opacity duration-200"
              }
            >
              <Input
                id="custom-limit"
                type="number"
                min="0"
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
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
};
