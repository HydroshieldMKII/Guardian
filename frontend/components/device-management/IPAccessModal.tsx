import React from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { useIPAccessForm } from "@/hooks/device-management/useIPAccessForm";
import { UserPreference, UserDevice } from "@/types";
import { AllowedIPsPanel } from "./ip-access/AllowedIPsPanel";
import {
  devicesWithIP,
  IP_OPTIONS,
  NETWORK_OPTIONS,
} from "./ip-access/options";
import { PolicyOptions } from "./ip-access/PolicyOptions";
import { StreamingAddresses } from "./ip-access/StreamingAddresses";

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
  const form = useIPAccessForm(isOpen, user.preference);
  const addressedDevices = devicesWithIP(userDevices);
  const hasDevices = userDevices.length > 0;
  const name = user.username || user.userId;

  const save = () => {
    onSave(user.userId, form.updates());
    onClose();
  };

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="lg">
      <ModalHeader
        title="Network access"
        description={
          <>
            Choose where{" "}
            <span className="font-medium text-foreground">{name}</span> is
            allowed to stream from. These rules apply to every one of their
            devices.
          </>
        }
      />

      <ModalBody className="space-y-8">
        <Section
          title="Network policy"
          description="Allow streaming from the local network, from the internet, or from both."
        >
          <PolicyOptions
            className="sm:grid-cols-3"
            options={NETWORK_OPTIONS}
            value={form.networkPolicy}
            onChange={form.setNetworkPolicy}
          />
        </Section>

        <Section
          title="IP access policy"
          description="Narrow access further to a list of specific IP addresses or address ranges."
        >
          <PolicyOptions
            className="sm:grid-cols-2"
            options={IP_OPTIONS}
            value={form.ipAccessPolicy}
            onChange={form.setIpAccessPolicy}
          />

          {form.ipAccessPolicy !== "all" && (
            <AllowedIPsPanel
              form={form}
              onAddCurrentAddresses={
                hasDevices
                  ? () =>
                      form.addAddresses(
                        addressedDevices.map((device) => device.ipAddress),
                      )
                  : undefined
              }
            />
          )}
        </Section>

        {hasDevices && (
          <StreamingAddresses name={name} devices={addressedDevices} />
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={form.noIPsConfigured}>
          Save policies
        </Button>
      </ModalFooter>
    </Modal>
  );
};
