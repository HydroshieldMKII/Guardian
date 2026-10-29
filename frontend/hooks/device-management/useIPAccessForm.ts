import { useEffect, useState } from "react";
import type {
  IPAccessPolicy,
  NetworkPolicy,
} from "@/components/device-management/ip-access/options";
import { isValidIPOrCIDR } from "@/lib/ipUtils";
import type { UserPreference } from "@/types";

const INVALID_ADDRESS =
  "Enter a valid IP address or address range, for example 192.168.1.1, 192.168.1.0/24, 2001:db8::1 or 2001:db8::/32";

export function useIPAccessForm(isOpen: boolean, preference?: UserPreference) {
  const [networkPolicy, setNetworkPolicy] = useState<NetworkPolicy>("both");
  const [ipAccessPolicy, setIpAccessPolicy] = useState<IPAccessPolicy>("all");
  const [allowedIPs, setAllowedIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState("");
  const [ipError, setIpError] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isOpen && !isInitialized) {
      setNetworkPolicy(preference?.networkPolicy || "both");
      setIpAccessPolicy(preference?.ipAccessPolicy || "all");
      setAllowedIPs(preference?.allowedIPs || []);
      setIsInitialized(true);
    } else if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen, isInitialized, preference]);

  const changeNewIP = (value: string) => {
    setNewIP(value);
    setIpError("");
  };

  const addIP = () => {
    const address = newIP.trim();
    if (!address) return;

    if (!isValidIPOrCIDR(address)) {
      setIpError(INVALID_ADDRESS);
      return;
    }

    if (allowedIPs.includes(address)) {
      setIpError("This address is already in the list");
      return;
    }

    setAllowedIPs([...allowedIPs, address]);
    setNewIP("");
    setIpError("");
  };

  const removeIP = (index: number) =>
    setAllowedIPs(allowedIPs.filter((_, i) => i !== index));

  const addAddresses = (addresses: string[]) => {
    const missing = [...new Set(addresses)].filter(
      (address) => !allowedIPs.includes(address),
    );
    if (missing.length > 0) setAllowedIPs([...allowedIPs, ...missing]);
  };

  const updates = (): Partial<UserPreference> => ({
    networkPolicy,
    ipAccessPolicy,
    allowedIPs: ipAccessPolicy === "all" ? [] : allowedIPs,
  });

  return {
    networkPolicy,
    setNetworkPolicy,
    ipAccessPolicy,
    setIpAccessPolicy,
    allowedIPs,
    newIP,
    changeNewIP,
    ipError,
    addIP,
    removeIP,
    addAddresses,
    noIPsConfigured: ipAccessPolicy === "restricted" && allowedIPs.length === 0,
    updates,
  };
}

export type IPAccessForm = ReturnType<typeof useIPAccessForm>;
