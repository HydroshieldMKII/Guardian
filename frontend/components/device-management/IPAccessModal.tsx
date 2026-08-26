import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Chip,
  EmptyState,
  Field,
  OptionCard,
  OptionGroup,
  Panel,
  PillRow,
  Section,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { UserPreference, UserDevice } from "@/types";
import { isValidIPOrCIDR, getNetworkType } from "@/lib/ipUtils";

const NETWORK_OPTIONS = [
  {
    value: "both" as const,
    title: "Both (LAN + WAN)",
    description: "Allow streaming from both local network and internet",
  },
  {
    value: "lan" as const,
    title: "LAN only",
    description: "Only allow streaming from local network (same subnet)",
  },
  {
    value: "wan" as const,
    title: "WAN only",
    description: "Only allow streaming from internet (remote access)",
  },
];

const IP_OPTIONS = [
  {
    value: "all" as const,
    title: "Any IP address",
    description: "Allow streaming from any IP address",
  },
  {
    value: "restricted" as const,
    title: "Restricted list",
    description: "Allow only specific IP addresses or CIDR ranges",
  },
];

interface IPAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    userId: string;
    username?: string;
    preference?: UserPreference;
  };
  userDevices: UserDevice[];
  onSave: (userId: string, updates: Partial<UserPreference>) => void;
}

export const IPAccessModal: React.FC<IPAccessModalProps> = ({
  isOpen,
  onClose,
  user,
  userDevices,
  onSave,
}) => {
  const [networkPolicy, setNetworkPolicy] = useState<"both" | "lan" | "wan">(
    "both",
  );
  const [ipAccessPolicy, setIpAccessPolicy] = useState<"all" | "restricted">(
    "all",
  );
  const [allowedIPs, setAllowedIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState("");
  const [ipError, setIpError] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize state only when modal first opens, not on subsequent updates
  useEffect(() => {
    if (isOpen && !isInitialized) {
      setNetworkPolicy(user.preference?.networkPolicy || "both");
      setIpAccessPolicy(user.preference?.ipAccessPolicy || "all");
      setAllowedIPs(user.preference?.allowedIPs || []);
      setIsInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag when modal closes
      setIsInitialized(false);
    }
  }, [isOpen, isInitialized, user.preference]);

  const devicesWithIP = userDevices.filter(
    (device): device is UserDevice & { ipAddress: string } =>
      Boolean(device.ipAddress),
  );

  // IP validation function using utility
  const validateIP = (ip: string): boolean => {
    return isValidIPOrCIDR(ip);
  };

  const handleAddIP = () => {
    const trimmedIP = newIP.trim();
    if (!trimmedIP) return;

    if (!validateIP(trimmedIP)) {
      setIpError(
        "Please enter a valid IP address or CIDR range (e.g. 192.168.1.1, 192.168.1.0/24, 2001:db8::1 or 2001:db8::/32)",
      );
      return;
    }

    if (allowedIPs.includes(trimmedIP)) {
      setIpError("This IP address is already in the list");
      return;
    }

    setAllowedIPs([...allowedIPs, trimmedIP]);
    setNewIP("");
    setIpError("");
  };

  const handleRemoveIP = (index: number) => {
    setAllowedIPs(allowedIPs.filter((_, i) => i !== index));
  };

  const handleAutoFillCurrentIPs = () => {
    const currentIPs = devicesWithIP
      .map((device) => device.ipAddress)
      .filter((ip, index, self) => self.indexOf(ip) === index); // Remove duplicates

    const newIPs = currentIPs.filter((ip) => !allowedIPs.includes(ip));
    if (newIPs.length > 0) {
      setAllowedIPs([...allowedIPs, ...newIPs]);
    }
  };

  const handleSave = () => {
    const updates: Partial<UserPreference> = {
      networkPolicy,
      ipAccessPolicy,
      allowedIPs: ipAccessPolicy === "all" ? [] : allowedIPs,
    };

    onSave(user.userId, updates);
  };

  const noIPsConfigured =
    ipAccessPolicy === "restricted" && allowedIPs.length === 0;

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="lg">
      <ModalHeader
        title="IP & Network Access"
        description={
          <>
            Configure network and IP-based access restrictions for{" "}
            <span className="font-medium text-foreground">
              {user.username || user.userId}
            </span>
            .
          </>
        }
      />

      <ModalBody className="space-y-8">
        <Section
          title="Network Policy"
          description="Control whether streaming is allowed from the local network, the internet, or both."
        >
          <OptionGroup className="sm:grid-cols-3">
            {NETWORK_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                selected={networkPolicy === option.value}
                title={option.title}
                description={option.description}
                onSelect={() => setNetworkPolicy(option.value)}
              />
            ))}
          </OptionGroup>
        </Section>

        <Section
          title="IP Access Policy"
          description="Restrict streaming to specific IP addresses or ranges."
        >
          <OptionGroup className="sm:grid-cols-2">
            {IP_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                selected={ipAccessPolicy === option.value}
                title={option.title}
                description={option.description}
                onSelect={() => setIpAccessPolicy(option.value)}
              />
            ))}
          </OptionGroup>

          {ipAccessPolicy !== "all" && (
            <Panel className="space-y-4">
              <Field
                label="Allowed IP addresses"
                htmlFor="new-ip"
                action={
                  userDevices.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoFillCurrentIPs}
                    >
                      Add Current Device IPs
                    </Button>
                  ) : undefined
                }
              >
                <div className="flex gap-2">
                  <Input
                    id="new-ip"
                    placeholder="e.g. 192.168.1.100, 192.168.1.0/24 or 2001:db8::/32"
                    value={newIP}
                    onChange={(e) => {
                      setNewIP(e.target.value);
                      setIpError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAddIP()}
                    aria-invalid={Boolean(ipError)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddIP} variant="outline">
                    Add
                  </Button>
                </div>
              </Field>

              {ipError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {ipError}
                </p>
              )}

              {allowedIPs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    {allowedIPs.length} IP address
                    {allowedIPs.length === 1 ? "" : "es"} configured
                  </p>
                  <PillRow>
                    {allowedIPs.map((ip, index) => (
                      <Chip
                        key={ip}
                        onRemove={() => handleRemoveIP(index)}
                        removeLabel={`Remove ${ip}`}
                      >
                        {ip}
                      </Chip>
                    ))}
                  </PillRow>
                </div>
              )}

              {noIPsConfigured && (
                <EmptyState
                  className="border-amber-500/30 bg-amber-500/5"
                  title="No IP addresses configured"
                  description="Add at least one IP address to restrict access, otherwise all access will be blocked."
                />
              )}
            </Panel>
          )}
        </Section>

        {userDevices.length > 0 && (
          <Section
            title={`Current device IPs for ${user.username || user.userId}`}
          >
            <PillRow>
              {devicesWithIP.map((device) => (
                <Chip key={device.deviceIdentifier} tone="info">
                  <span className="max-w-[140px] truncate font-sans">
                    {device.deviceName || device.deviceIdentifier}
                  </span>
                  {`${device.ipAddress} (${getNetworkType(
                    device.ipAddress,
                  ).toUpperCase()})`}
                </Chip>
              ))}
            </PillRow>
          </Section>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={noIPsConfigured}>
          Save Policies
        </Button>
      </ModalFooter>
    </Modal>
  );
};
