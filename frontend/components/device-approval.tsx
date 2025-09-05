"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Monitor,
  MapPin,
  Clock,
  User,
  Smartphone,
  Tv,
  Laptop,
  RefreshCw,
  Eye,
  Settings,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface UserDevice {
  id: number;
  userId: string;
  username: string | null;
  deviceIdentifier: string;
  deviceName: string | null;
  devicePlatform: string | null;
  deviceProduct: string | null;
  deviceVersion: string | null;
  status: "pending" | "approved" | "rejected";
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export function DeviceApproval() {
  const [allDevices, setAllDevices] = useState<UserDevice[]>([]);
  const [pendingDevices, setPendingDevices] = useState<UserDevice[]>([]);
  const [processedDevices, setProcessedDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [showApproved, setShowApproved] = useState(false);

  const fetchDevices = async () => {
    try {
      setLoading(true);

      // Fetch all devices
      const allResponse = await fetch("http://localhost:3001/devices");
      const allData: UserDevice[] = await allResponse.json();
      setAllDevices(allData);

      // Fetch pending devices (truly new devices)
      const pendingResponse = await fetch(
        "http://localhost:3001/devices/pending"
      );
      const pendingData: UserDevice[] = await pendingResponse.json();
      setPendingDevices(pendingData);

      // Fetch processed devices (approved or rejected)
      const processedResponse = await fetch(
        "http://localhost:3001/devices/processed"
      );
      const processedData: UserDevice[] = await processedResponse.json();
      setProcessedDevices(processedData);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `http://localhost:3001/devices/${deviceId}/approve`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        await fetchDevices(); // Refresh the list
      } else {
        console.error("Failed to approve device");
      }
    } catch (error) {
      console.error("Error approving device:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `http://localhost:3001/devices/${deviceId}/reject`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        await fetchDevices(); // Refresh the list
      } else {
        console.error("Failed to reject device");
      }
    } catch (error) {
      console.error("Error rejecting device:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (deviceId: number) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `http://localhost:3001/devices/${deviceId}/delete`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        await fetchDevices(); // Refresh the list
      } else {
        console.error("Failed to delete device");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleApproval = async (device: UserDevice) => {
    if (device.status === 'approved') {
      await handleReject(device.id);
    } else {
      await handleApprove(device.id);
    }
  };

  const getDeviceIcon = (platform: string | null, product: string | null) => {
    const p = platform?.toLowerCase() || product?.toLowerCase() || "";

    if (
      p.includes("android") ||
      p.includes("iphone") ||
      p.includes("ios") ||
      p.includes("mobile")
    ) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (
      p.includes("tv") ||
      p.includes("roku") ||
      p.includes("apple tv") ||
      p.includes("chromecast")
    ) {
      return <Tv className="w-4 h-4" />;
    }
    if (p.includes("windows") || p.includes("mac") || p.includes("linux")) {
      return <Laptop className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDeviceStatus = (device: UserDevice) => {
    switch (device.status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="bg-orange-500">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="secondary">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const devicesToShow = showApproved ? processedDevices : pendingDevices;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Device Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Device Management
              </CardTitle>
              <CardDescription className="mt-1">
                Manage device access to your Plex server
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                <Button
                  variant={!showApproved ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowApproved(false)}
                >
                  Pending ({pendingDevices.length})
                </Button>
                <Button
                  variant={showApproved ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowApproved(true)}
                >
                  Processed Devices ({processedDevices.length})
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={fetchDevices}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {devicesToShow.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400">
              <CheckCircle className="w-6 h-6 mr-2" />
              {showApproved
                ? "No processed devices found"
                : "No pending devices"}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {devicesToShow.map((device) => (
                  <div
                    key={device.id}
                    className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getDeviceIcon(
                            device.devicePlatform,
                            device.deviceProduct
                          )}
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {device.deviceName || device.deviceIdentifier}
                          </h3>
                          {getDeviceStatus(device)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {device.username || device.userId}
                          </div>
                          <div className="flex items-center">
                            <Monitor className="w-3 h-3 mr-1" />
                            {device.devicePlatform || "Unknown Platform"}
                          </div>
                          <div className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {device.ipAddress || "Unknown IP"}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Sessions: {device.sessionCount}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDevice(device)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Details
                        </Button>

                        {!showApproved ? (
                          /* Pending devices: Show Approve, Reject, Delete buttons */
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApprove(device.id)}
                              disabled={actionLoading === device.id}
                              className="bg-green-500 hover:bg-green-600"
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(device.id)}
                              disabled={actionLoading === device.id}
                              className="border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3 mr-1" />
                              )}
                              Reject
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(device.id)}
                              disabled={actionLoading === device.id}
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3 mr-1" />
                              )}
                            </Button>
                          </>
                        ) : (
                          /* Processed devices: Show Toggle Approval and Delete buttons */
                          <>
                            <Button
                              variant={device.status === 'approved' ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleApproval(device)}
                              disabled={actionLoading === device.id}
                              className={
                                device.status === 'approved'
                                  ? "bg-green-500 hover:bg-green-600"
                                  : "border-orange-500 text-orange-600 hover:bg-orange-50"
                              }
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : device.status === 'approved' ? (
                                <ToggleRight className="w-3 h-3 mr-1" />
                              ) : (
                                <ToggleLeft className="w-3 h-3 mr-1" />
                              )}
                              {device.status === 'approved' ? "Approved" : "Rejected"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(device.id)}
                              disabled={actionLoading === device.id}
                            >
                              {actionLoading === device.id ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3 mr-1" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>First seen: {formatDate(device.firstSeen)}</span>
                      <span className="mx-2">•</span>
                      <span>Last seen: {formatDate(device.lastSeen)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Device Details Dialog */}
      <Dialog
        open={!!selectedDevice}
        onOpenChange={() => setSelectedDevice(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Device Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this device
            </DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Device Name
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.deviceName || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    User
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.username || selectedDevice.userId}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Platform
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.devicePlatform || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Product
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.deviceProduct || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Version
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.deviceVersion || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    IP Address
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.ipAddress || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Sessions
                  </h4>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedDevice.sessionCount}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Status
                  </h4>
                  <div>{getDeviceStatus(selectedDevice)}</div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Device Identifier
                </h4>
                <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  {selectedDevice.deviceIdentifier}
                </p>
              </div>

              {selectedDevice.userAgent && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400 mb-2">
                    User Agent
                  </h4>
                  <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    {selectedDevice.userAgent}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    First Seen
                  </h4>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {formatDate(selectedDevice.firstSeen)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                    Last Seen
                  </h4>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {formatDate(selectedDevice.lastSeen)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDevice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
