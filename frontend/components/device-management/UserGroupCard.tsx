import React from 'react';
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  Settings,
  CheckCircle,
  XCircle,
  Monitor
} from "lucide-react";
import { UserDevice, UserPreference, AppSetting } from '@/types';
import { UserAvatar, getUserPreferenceBadge } from './SharedComponents';
import { DeviceCard } from './DeviceCard';

// User-Device group interface
interface UserDeviceGroup {
  user: {
    userId: string;
    username?: string;
    preference?: UserPreference;
  };
  devices: UserDevice[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

interface UserGroupCardProps {
  group: UserDeviceGroup;
  isExpanded: boolean;
  settingsData?: AppSetting[];
  actionLoading: number | null;
  editingDevice: number | null;
  newDeviceName: string;
  onToggleExpansion: (userId: string) => void;
  onUpdateUserPreference: (userId: string, defaultBlock: boolean | null) => void;
  onEdit: (device: UserDevice) => void;
  onCancelEdit: () => void;
  onRename: (deviceId: number, newName: string) => void;
  onApprove: (device: UserDevice) => void;
  onReject: (device: UserDevice) => void;
  onDelete: (device: UserDevice) => void;
  onToggleApproval: (device: UserDevice) => void;
  onGrantTempAccess: (deviceId: number) => void;
  onRevokeTempAccess: (deviceId: number) => void;
  onShowDetails: (device: UserDevice) => void;
  onNewDeviceNameChange: (name: string) => void;
  shouldShowGrantTempAccess: (device: UserDevice) => boolean;
}

export const UserGroupCard: React.FC<UserGroupCardProps> = ({
  group,
  isExpanded,
  settingsData,
  actionLoading,
  editingDevice,
  newDeviceName,
  onToggleExpansion,
  onUpdateUserPreference,
  onEdit,
  onCancelEdit,
  onRename,
  onApprove,
  onReject,
  onDelete,
  onToggleApproval,
  onGrantTempAccess,
  onRevokeTempAccess,
  onShowDetails,
  onNewDeviceNameChange,
  shouldShowGrantTempAccess,
}) => {
  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => onToggleExpansion(group.user.userId)}
    >
      <div 
        className="rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow"
        data-user-id={group.user.userId}
      >
        <CollapsibleTrigger asChild>
          <div className="p-3 sm:p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <UserAvatar 
                  userId={group.user.userId}
                  username={group.user.username}
                  avatarUrl={group.user.preference?.avatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">
                    {group.user.username || group.user.userId}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {group.devices.length} device{group.devices.length !== 1 ? 's' : ''}
                    {group.pendingCount > 0 && ` • ${group.pendingCount} pending`}
                    {group.approvedCount > 0 && ` • ${group.approvedCount} approved`}
                    {group.rejectedCount > 0 && ` • ${group.rejectedCount} rejected`}
                  </p>
                </div>
                <div className="hidden sm:flex">
                  {group.user.preference && getUserPreferenceBadge(group.user.preference.defaultBlock)}
                </div>
              </div>
              
              {/* Mobile: Show preference badge */}
              <div className="sm:hidden">
                {group.user.preference && getUserPreferenceBadge(group.user.preference.defaultBlock)}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-3 sm:p-4 space-y-4">
            {/* User Preference Controls */}
            <div className="flex flex-col gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Default Device Policy:</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={!group.user.preference || group.user.preference.defaultBlock === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => onUpdateUserPreference(group.user.userId, null)}
                  className="text-xs px-2 py-1"
                >
                  <Settings className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Global</span>
                  <span className="sm:hidden">Global</span>
                </Button>
                <Button
                  variant={group.user.preference?.defaultBlock === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => onUpdateUserPreference(group.user.userId, false)}
                  className={`text-xs px-2 py-1 ${
                    group.user.preference?.defaultBlock === false
                      ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                      : ""
                  }`}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Allow</span>
                  <span className="sm:hidden">Allow</span>
                </Button>
                <Button
                  variant={group.user.preference?.defaultBlock === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => onUpdateUserPreference(group.user.userId, true)}
                  className={`text-xs px-2 py-1 ${
                    group.user.preference?.defaultBlock === true
                      ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white"
                      : ""
                  }`}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Block</span>
                  <span className="sm:hidden">Block</span>
                </Button>
              </div>
            </div>

            {/* Devices List */}
            {group.devices.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Monitor className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No devices found for this user</p>
              </div>
            ) : (
              <div className="space-y-4">
                {group.devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    settingsData={settingsData}
                    actionLoading={actionLoading}
                    editingDevice={editingDevice}
                    newDeviceName={newDeviceName}
                    onEdit={onEdit}
                    onCancelEdit={onCancelEdit}
                    onRename={onRename}
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelete={onDelete}
                    onToggleApproval={onToggleApproval}
                    onGrantTempAccess={onGrantTempAccess}
                    onRevokeTempAccess={onRevokeTempAccess}
                    onShowDetails={onShowDetails}
                    onNewDeviceNameChange={onNewDeviceNameChange}
                    shouldShowGrantTempAccess={shouldShowGrantTempAccess}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};