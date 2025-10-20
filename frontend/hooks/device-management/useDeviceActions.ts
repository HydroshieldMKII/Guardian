import { useState } from 'react';
import { config } from '@/lib/config';
import { UserDevice } from '@/types';

export const useDeviceActions = () => {
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const approveDevice = async (deviceId: number): Promise<boolean> => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/approve`,
        {
          method: "POST",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error approving device:", error);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const rejectDevice = async (deviceId: number): Promise<boolean> => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/reject`,
        {
          method: "POST",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error rejecting device:", error);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const deleteDevice = async (deviceId: number): Promise<boolean> => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/delete`,
        {
          method: "POST",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error deleting device:", error);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const renameDevice = async (deviceId: number, newName: string): Promise<boolean> => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/rename`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newName }),
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error renaming device:", error);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const grantTemporaryAccess = async (deviceId: number, durationMinutes: number): Promise<boolean> => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/temporary-access`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ durationMinutes }),
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error granting temporary access:", error);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const grantBatchTemporaryAccess = async (deviceIds: number[], durationMinutes: number): Promise<{ success: boolean; results?: any }> => {
    try {
      setActionLoading(deviceIds[0]); // Set loading for the first device as indicator
      
      const response = await fetch(
        `${config.api.baseUrl}/devices/batch/temporary-access`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceIds, durationMinutes }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, results: data.results };
      } else {
        console.error('Batch temporary access failed:', response.status, await response.text());
        return { success: false };
      }
    } catch (error) {
      console.error("Error granting batch temporary access:", error);
      return { success: false };
    } finally {
      setActionLoading(null);
    }
  };

  const revokeTemporaryAccess = async (deviceId: number): Promise<boolean> => {
    try {
      setActionLoading(deviceId);
      const response = await fetch(
        `${config.api.baseUrl}/devices/${deviceId}/revoke-temporary-access`,
        {
          method: "POST",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error revoking temporary access:", error);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const toggleApproval = async (device: UserDevice): Promise<boolean> => {
    if (device.status === "approved") {
      return await rejectDevice(device.id);
    } else {
      return await approveDevice(device.id);
    }
  };

  return {
    actionLoading,
    approveDevice,
    rejectDevice,
    deleteDevice,
    renameDevice,
    grantTemporaryAccess,
    grantBatchTemporaryAccess,
    revokeTemporaryAccess,
    toggleApproval,
  };
};