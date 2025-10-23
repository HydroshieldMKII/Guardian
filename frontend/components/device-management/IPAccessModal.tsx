import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Wifi,
  Router,
  Shield,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Network,
} from "lucide-react";
import { UserPreference, UserDevice } from "@/types";
import {
  isValidIPOrCIDR,
  getNetworkType,
  formatIPForDisplay,
} from "@/lib/ipUtils";

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

  // IP validation function using utility
  const validateIP = (ip: string): boolean => {
    return isValidIPOrCIDR(ip);
  };

  const handleAddIP = () => {
    const trimmedIP = newIP.trim();
    if (!trimmedIP) return;

    if (!validateIP(trimmedIP)) {
      setIpError(
        "Please enter a valid IP address or CIDR range (e.g. 192.168.1.1 or 192.168.1.0/24)",
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
    const currentIPs = userDevices
      .filter((device) => device.ipAddress)
      .map((device) => device.ipAddress!)
      .filter((ip, index, self) => self.indexOf(ip) === index); // Remove duplicates

    const newIPs = currentIPs.filter((ip) => !allowedIPs.includes(ip));
    if (newIPs.length > 0) {
      setAllowedIPs([...allowedIPs, ...newIPs]);
    }
  };

  const handleSave = () => {
    // Validate that IP restrictions have at least one IP address
    if (ipAccessPolicy === "restricted" && allowedIPs.length === 0) {
      setIpError(
        "Please add at least one IP address when restricting access by IP",
      );
      return;
    }

    const updates: Partial<UserPreference> = {
      networkPolicy,
      ipAccessPolicy,
      allowedIPs: ipAccessPolicy === "all" ? [] : allowedIPs,
    };

    onSave(user.userId, updates);
  };

  const getNetworkIcon = (type: string) => {
    switch (type) {
      case "both":
        return <Globe className="w-4 h-4" />;
      case "lan":
        return <Wifi className="w-4 h-4" />;
      case "wan":
        return <Router className="w-4 h-4" />;
      default:
        return <Network className="w-4 h-4" />;
    }
  };

  const getNetworkDescription = (type: string) => {
    switch (type) {
      case "both":
        return "Allow streaming from both local network and internet";
      case "lan":
        return "Only allow streaming from local network (same subnet)";
      case "wan":
        return "Only allow streaming from internet (remote access)";
      default:
        return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            IP & Network Access Policies
          </DialogTitle>
          <DialogDescription>
            Configure network and IP-based access restrictions for{" "}
            {user.username || user.userId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Network Policy Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {/* <Network className="w-4 h-4 text-primary" /> */}
                <h3 className="font-semibold text-sm">Network Policy</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Control whether streaming is allowed from local network,
                internet, or both
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["both", "lan", "wan"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setNetworkPolicy(type)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-left cursor-pointer ${
                    networkPolicy === type
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getNetworkIcon(type)}
                    <span className="font-medium text-sm capitalize">
                      {type === "both"
                        ? "Both (LAN + WAN)"
                        : type.toUpperCase()}
                    </span>
                    {networkPolicy === type && (
                      <CheckCircle className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getNetworkDescription(type)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* IP Access Policy Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {/* <Globe className="w-4 h-4 text-primary" /> */}
                <h3 className="font-semibold text-sm">IP Access Policy</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Restrict streaming to specific IP addresses or ranges
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["all", "restricted"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setIpAccessPolicy(type)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-left cursor-pointer ${
                    ipAccessPolicy === type
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm capitalize">
                      {type}
                    </span>
                    {ipAccessPolicy === type && (
                      <CheckCircle className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {type === "all" && "Allow streaming from any IP address"}
                    {type === "restricted" &&
                      "Allow only specific IP addresses or CIDR ranges"}
                  </p>
                </button>
              ))}
            </div>

            {/* IP List Management */}
            {ipAccessPolicy !== "all" && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Allowed IP Addresses
                  </Label>
                  {userDevices.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoFillCurrentIPs}
                      className="text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Current Device IPs
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 192.168.1.100 or 192.168.1.0/24"
                    value={newIP}
                    onChange={(e) => {
                      setNewIP(e.target.value);
                      setIpError("");
                    }}
                    onKeyPress={(e) => e.key === "Enter" && handleAddIP()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddIP} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {ipError && (
                  <div className="flex items-center gap-2 text-red-600 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    {ipError}
                  </div>
                )}

                {allowedIPs.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {allowedIPs.length} IP address
                      {allowedIPs.length !== 1 ? "es" : ""} configured
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {allowedIPs.map((ip, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="flex items-center gap-1 text-xs"
                        >
                          {ip}
                          <button
                            onClick={() => handleRemoveIP(index)}
                            className="ml-1 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {ipAccessPolicy === "restricted" && allowedIPs.length === 0 && (
                  <div className="flex items-center gap-2 py-4 px-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <div className="text-left text-yellow-800 dark:text-yellow-200 text-xs">
                      <strong>Warning:</strong> No IP addresses configured. Add
                      at least one IP address to restrict access, otherwise all
                      access will be blocked.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Current Device IPs Info */}
          {userDevices.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Label className="text-xs font-medium text-blue-800 dark:text-blue-200 block mb-1">
                Current Device IPs for {user.username || user.userId}:
              </Label>
              <div className="flex flex-wrap gap-1">
                {userDevices
                  .filter((device) => device.ipAddress)
                  .map((device, index) => {
                    const networkType = device.ipAddress
                      ? getNetworkType(device.ipAddress)
                      : "unknown";
                    return (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-xs bg-blue-100 dark:bg-blue-800/50"
                      >
                        {device.deviceName || device.deviceIdentifier}:{" "}
                        {device.ipAddress} ({networkType.toUpperCase()})
                      </Badge>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              ipAccessPolicy === "restricted" && allowedIPs.length === 0
            }
          >
            Save Policies
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
