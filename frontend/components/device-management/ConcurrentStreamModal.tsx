"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Users, Loader2, Info } from "lucide-react";
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
    (s) => s.key === "CONCURRENT_STREAM_LIMIT"
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
              userId
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Concurrent Stream Limit
          </DialogTitle>
          <DialogDescription>
            Set the maximum number of simultaneous streams for{" "}
            <span className="font-semibold">{username || userId}</span>
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Global limit info */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-muted-foreground">
                  Global limit:{" "}
                  <span className="font-medium text-foreground">
                    {globalLimitValue === 0 ? "Unlimited" : globalLimitValue}
                  </span>
                </p>
              </div>
            </div>

            {/* Use global default toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="use-global" className="text-sm font-medium">
                  Use global default
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apply the global concurrent stream limit to this user
                </p>
              </div>
              <Switch
                id="use-global"
                checked={useGlobalDefault}
                onCheckedChange={setUseGlobalDefault}
                className="cursor-pointer"
              />
            </div>

            {/* Custom limit input */}
            <div
              className={`space-y-2 transition-opacity duration-200 ${useGlobalDefault ? "opacity-50" : ""}`}
            >
              <Label htmlFor="custom-limit" className="text-sm font-medium">
                Custom limit for this user
              </Label>
              <Input
                id="custom-limit"
                type="number"
                min="0"
                value={customLimit}
                onChange={(e) => setCustomLimit(e.target.value)}
                disabled={useGlobalDefault}
                placeholder="0 = unlimited"
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 for unlimited streams, or enter a specific limit
              </p>
            </div>

            {/* Effective limit display */}
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Effective limit: </span>
                <span className="font-semibold">
                  {effectiveLimit === 0
                    ? "Unlimited"
                    : `${effectiveLimit} concurrent stream${effectiveLimit !== 1 ? "s" : ""}`}
                </span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
