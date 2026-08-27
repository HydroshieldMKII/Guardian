import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, RefreshCw } from "lucide-react";
import { UserDevice } from "@/types";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import {
  EmptyState,
  Field,
  Panel,
  Section,
  SegmentedControl,
  SelectRow,
  ToggleRow,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DURATION_UNITS = ["minutes", "hours", "days", "weeks"] as const;

const QUICK_DURATIONS = [
  { label: "1 hour", value: 1, unit: "hours" as const },
  { label: "3 hours", value: 3, unit: "hours" as const },
  { label: "6 hours", value: 6, unit: "hours" as const },
  { label: "1 day", value: 1, unit: "days" as const },
  { label: "1 week", value: 1, unit: "weeks" as const },
];

const BYPASSED_POLICIES = [
  {
    name: "Network Policy",
    detail: "Restrictions on local network or internet streaming",
  },
  {
    name: "IP Access",
    detail: "The allowed list of IP addresses and address ranges",
  },
  {
    name: "Time Schedule",
    detail: "The hours during which streaming is blocked",
  },
  {
    name: "Device Approval",
    detail: "Devices still pending approval, or already rejected",
  },
];

const EXPIRY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

interface TemporaryAccessModalProps {
  user: {
    userId: string;
    username?: string;
  } | null;
  userDevices: UserDevice[];
  isOpen: boolean;
  onClose: () => void;
  onGrantAccess: (
    deviceIds: number[],
    durationMinutes: number,
    bypassPolicies?: boolean,
  ) => void;
  actionLoading: number | null;
  canGrantTemporaryAccess: (device: UserDevice) => boolean;
}

export const TemporaryAccessModal: React.FC<TemporaryAccessModalProps> = ({
  user,
  userDevices,
  isOpen,
  onClose,
  onGrantAccess,
  actionLoading,
  canGrantTemporaryAccess,
}) => {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [durationValue, setDurationValue] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<
    "minutes" | "hours" | "days" | "weeks"
  >("hours");
  const [bypassPolicies, setBypassPolicies] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<"duration" | "calendar">(
    "duration",
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const { convertToMinutes, isValidDuration, hasTemporaryAccess } =
    useDeviceUtils();

  // Check if the calculated expiry date is valid
  const getExpiryDate = (): Date | null => {
    if (inputMode === "calendar") {
      if (!selectedDate) return null;
      // Ensure the selected date is in the future
      if (selectedDate.getTime() <= Date.now()) return null;
      return selectedDate;
    }

    if (durationValue <= 0 || !isValidDuration(durationValue, durationUnit)) {
      return null;
    }
    const totalMinutes = convertToMinutes(durationValue, durationUnit);
    const expiryDate = new Date(Date.now() + totalMinutes * 60 * 1000);
    // Check if the date is valid (not NaN or beyond JS max date)
    if (
      isNaN(expiryDate.getTime()) ||
      expiryDate.getTime() > 8640000000000000
    ) {
      return null;
    }
    return expiryDate;
  };

  const isExpiryDateValid = getExpiryDate() !== null;

  // Get eligible devices for temporary access
  const eligibleDevices = userDevices.filter((device) =>
    canGrantTemporaryAccess(device),
  );

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedDeviceIds([]);
      setDurationValue(1);
      setDurationUnit("hours");
      setBypassPolicies(false);
      setInputMode("duration");
      setSelectedDate(undefined);
    }
  }, [isOpen]);

  const handleDeviceToggle = (deviceId: number) => {
    setSelectedDeviceIds((prev) => {
      if (prev.includes(deviceId)) {
        return prev.filter((id) => id !== deviceId);
      } else {
        return [...prev, deviceId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedDeviceIds.length === eligibleDevices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(eligibleDevices.map((device) => device.id));
    }
  };

  const handleGrantAccess = () => {
    if (selectedDeviceIds.length === 0 || !isExpiryDateValid) return;

    let totalMinutes: number;
    if (inputMode === "calendar" && selectedDate) {
      // Calculate minutes from now until selected date
      totalMinutes = Math.ceil(
        (selectedDate.getTime() - Date.now()) / (60 * 1000),
      );
    } else {
      totalMinutes = convertToMinutes(durationValue, durationUnit);
    }

    onGrantAccess(selectedDeviceIds, totalMinutes, bypassPolicies);
  };

  if (!user) return null;

  const allSelected =
    eligibleDevices.length > 0 &&
    selectedDeviceIds.length === eligibleDevices.length;
  const expiry = getExpiryDate();
  const durationTooLarge =
    inputMode === "duration" &&
    durationValue > 0 &&
    isValidDuration(durationValue, durationUnit) &&
    !isExpiryDateValid;

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="lg">
      <ModalHeader
        title="Temporary Access"
        description={
          <>
            Grant temporary streaming access to{" "}
            <span className="font-medium text-foreground">
              {user.username || user.userId}
            </span>
            &apos;s devices.
          </>
        }
      />

      <ModalBody className="space-y-8">
        <Section
          title={`Select Devices (${selectedDeviceIds.length} selected)`}
          action={
            eligibleDevices.length > 0 ? (
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            ) : undefined
          }
        >
          {eligibleDevices.length === 0 ? (
            <EmptyState
              title="No devices are eligible for temporary access"
              description="Only devices that are currently blocked can be granted temporary access, meaning devices this user has had rejected, or devices still pending approval while the default policy blocks them."
            />
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {eligibleDevices.map((device) => (
                <SelectRow
                  key={device.id}
                  selected={selectedDeviceIds.includes(device.id)}
                  onToggle={() => handleDeviceToggle(device.id)}
                  title={device.deviceName || device.deviceIdentifier}
                  subtitle={
                    <>
                      {device.devicePlatform} · {device.status}
                      {hasTemporaryAccess(device) && (
                        <span className="ml-2 font-medium text-sky-600 dark:text-sky-400">
                          Already has temporary access
                        </span>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </Section>

        {selectedDeviceIds.length > 0 && (
          <Section
            title="Access Duration"
            action={
              <SegmentedControl
                value={inputMode}
                onChange={setInputMode}
                options={[
                  { value: "duration", label: "Duration" },
                  { value: "calendar", label: "Calendar" },
                ]}
              />
            }
          >
            {inputMode === "duration" ? (
              <div className="space-y-4">
                <div className="flex items-end gap-2">
                  <Field
                    label="Duration"
                    htmlFor="duration-value"
                    className="flex-1"
                  >
                    <Input
                      id="duration-value"
                      type="number"
                      value={durationValue}
                      onChange={(e) => setDurationValue(Number(e.target.value))}
                      min="1"
                      max="999"
                      placeholder="Enter duration"
                    />
                  </Field>
                  <Field label="Unit" className="w-28">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          aria-label="Duration unit"
                          className="w-full justify-between font-normal"
                        >
                          {durationUnit}
                          <ChevronDown className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {DURATION_UNITS.map((unit) => (
                          <DropdownMenuItem
                            key={unit}
                            onClick={() => setDurationUnit(unit)}
                          >
                            {unit}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Field>
                </div>

                <Field label="Common Durations">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_DURATIONS.map((quick) => (
                      <Button
                        key={quick.label}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDurationValue(quick.value);
                          setDurationUnit(quick.unit);
                        }}
                      >
                        {quick.label}
                      </Button>
                    ))}
                  </div>
                </Field>
              </div>
            ) : (
              <Field label="Expires On">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground",
                      )}
                    >
                      {selectedDate ? (
                        selectedDate.toLocaleString(undefined, EXPIRY_FORMAT)
                      ) : (
                        <span>Pick a date and time</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          const now = new Date();
                          date.setHours(now.getHours() + 1);
                          date.setMinutes(now.getMinutes());
                          setSelectedDate(date);
                        } else {
                          setSelectedDate(undefined);
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      autoFocus
                    />
                    {selectedDate && (
                      <div className="border-t p-3">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                          Time
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="23"
                            value={selectedDate.getHours()}
                            onChange={(e) => {
                              const hours = parseInt(e.target.value) || 0;
                              const newDate = new Date(selectedDate);
                              newDate.setHours(
                                Math.min(23, Math.max(0, hours)),
                              );
                              setSelectedDate(newDate);
                            }}
                            className="w-16 text-center"
                            placeholder="HH"
                          />
                          <span className="self-center text-muted-foreground">
                            :
                          </span>
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            value={selectedDate.getMinutes()}
                            onChange={(e) => {
                              const minutes = parseInt(e.target.value) || 0;
                              const newDate = new Date(selectedDate);
                              newDate.setMinutes(
                                Math.min(59, Math.max(0, minutes)),
                              );
                              setSelectedDate(newDate);
                            }}
                            className="w-16 text-center"
                            placeholder="MM"
                          />
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </Field>
            )}

            {inputMode === "duration" && durationValue <= 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Please enter a valid duration
              </p>
            )}

            {inputMode === "calendar" &&
              selectedDate &&
              selectedDate.getTime() <= Date.now() && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  Selected date must be in the future
                </p>
              )}

            {durationTooLarge && (
              <Panel tone="danger">
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  Duration is too large. Please enter a smaller value.
                </p>
              </Panel>
            )}

            {expiry && (
              <Panel tone="info">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  Access will expire at
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {expiry.toLocaleString(undefined, {
                    ...EXPIRY_FORMAT,
                    second: "2-digit",
                    timeZoneName: "short",
                  })}
                </p>
              </Panel>
            )}
          </Section>
        )}

        {selectedDeviceIds.length > 0 && (
          <Section title="Policy Bypass">
            <Panel tone="warning" className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                While temporary access lasts, the selected devices stream
                without any of the following being enforced:
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {BYPASSED_POLICIES.map((policy) => (
                  <li key={policy.name}>
                    <span className="font-medium text-foreground">
                      {policy.name}
                    </span>{" "}
                    — {policy.detail}
                  </li>
                ))}
              </ul>
              <ToggleRow
                id="bypass-policies"
                label="Bypass these policies for the selected devices"
                hint="The concurrent stream limit is not affected. Whether temporary access counts towards it is controlled by its own setting in Guardian settings."
                checked={bypassPolicies}
                onCheckedChange={setBypassPolicies}
              />
            </Panel>
          </Section>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={actionLoading !== null}
        >
          Cancel
        </Button>
        <Button
          onClick={handleGrantAccess}
          disabled={
            actionLoading !== null ||
            selectedDeviceIds.length === 0 ||
            !isValidDuration(durationValue, durationUnit) ||
            !isExpiryDateValid
          }
        >
          {actionLoading ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Granting Access...
            </>
          ) : (
            "Grant Access"
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
