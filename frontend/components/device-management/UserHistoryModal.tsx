import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  Clock,
  Monitor,
  MapPin,
  Calendar,
  Play,
  Eye,
  X,
  UserRoundSearch,
  RefreshCw,
  Radio,
  Trash2
} from "lucide-react";
import { config } from '@/lib/config';
import { ClickableIP } from './SharedComponents';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useToast } from '@/hooks/use-toast';

interface UserDevice {
  id: number;
  userId: string;
  deviceIdentifier: string;
  deviceName?: string;
  devicePlatform?: string;
  deviceProduct?: string;
  deviceVersion?: string;
  status: string;
  sessionCount: number;
}

interface SessionHistoryEntry {
  id: number;
  sessionKey: string;
  userId: string;
  username?: string;
  userDevice?: UserDevice;
  deviceAddress?: string;
  contentTitle?: string;
  contentType?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  year?: number;
  startedAt: string;
  endedAt?: string;
  thumb?: string;
  art?: string;
}

interface UserHistoryModalProps {
  userId: string | null;
  username?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
}

export const UserHistoryModal: React.FC<UserHistoryModalProps> = ({
  userId,
  username,
  isOpen,
  onClose,
  onNavigateToDevice,
}) => {
  const [sessions, setSessions] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<SessionHistoryEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toast } = useToast();

  const fetchUserHistory = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/sessions/history/${userId}?limit=100&includeActive=true`);
      if (response.ok) {
        const data = await response.json();
        // Sort by most recent first (startedAt descending)
        const sortedData = (data || []).sort((a: SessionHistoryEntry, b: SessionHistoryEntry) => 
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        setSessions(sortedData);
      } else {
        console.error('Failed to fetch user history');
        setSessions([]);
      }
    } catch (error) {
      console.error('Error fetching user history:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserHistory();
    }
  }, [isOpen, userId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatTitle = (session: SessionHistoryEntry) => {
    if (session.contentType === 'episode' && session.grandparentTitle) {
      // For TV episodes: "Series - Season X - Episode Title"
      const parts = [session.grandparentTitle];
      if (session.parentTitle) {
        parts.push(session.parentTitle);
      }
      if (session.contentTitle) {
        parts.push(session.contentTitle);
      }
      return parts.join(' - ');
    }
    // For movies or other content
    return session.contentTitle || 'Unknown Title';
  };

  const getDeviceDisplayName = (session: SessionHistoryEntry) => {
    return session.userDevice?.deviceName || session.userDevice?.deviceProduct || 'Unknown Device';
  };

  const formatDuration = (session: SessionHistoryEntry) => {
    if (!session.endedAt) {
      return 'N/A';
    }

    const startTime = new Date(session.startedAt).getTime();
    const endTime = new Date(session.endedAt).getTime();
    const durationMs = endTime - startTime;

    if (durationMs < 0) return 'Unknown';

    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      const remainingSeconds = seconds % 60;
      return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const filteredSessions = sessions.filter(session =>
    formatTitle(session).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getDeviceDisplayName(session).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (session.deviceAddress || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeviceClick = (session: SessionHistoryEntry) => {
    if (onNavigateToDevice && userId && session.userDevice?.deviceIdentifier) {
      onClose(); // Close the modal first
      onNavigateToDevice(userId, session.userDevice.deviceIdentifier);
    }
  };

  const handleDeleteClick = (session: SessionHistoryEntry) => {
    setSessionToDelete(session);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/sessions/history/${sessionToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the session from the local state
        setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
        setSessionToDelete(null);
        toast({
          title: "Session Deleted",
          description: "The session history has been successfully deleted.",
          variant: "success",
        });
      } else {
        toast({
          title: "Delete Failed", 
          description: "Failed to delete session history. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "An error occurred while deleting the session history.",
        variant: "destructive", 
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancelDelete = () => {
    setSessionToDelete(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] max-h-[90vh] h-[90vh] overflow-hidden flex flex-col" style={{ width: '95vw !important', maxWidth: '95vw !important', minWidth: '95vw' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Streaming History - {username || userId}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search and Refresh */}
          <div className="flex gap-3 px-1 pt-1">
            <Input
              placeholder="Search by title, device, or IP address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUserHistory}
              disabled={loading}
              className="flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-auto border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading history...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Clock className="w-8 h-8 mb-2" />
                <p>{searchTerm ? 'No sessions found matching your search' : 'No streaming history found'}</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block divide-y">
                  {/* Header */}
                  <div className="grid grid-cols-8 gap-2 p-3 bg-muted text-sm font-medium sticky top-0 z-10">
                    <div>Content</div>
                    <div>Device</div>
                    <div>Platform</div>
                    <div>IP Address</div>
                    <div>Started</div>
                    <div>Ended</div>
                    <div>Duration</div>
                    <div>Actions</div>
                  </div>

                  {/* Desktop Session Rows */}
                  {filteredSessions.map((session) => (
                    <div 
                      key={session.id} 
                      className={`grid grid-cols-8 gap-2 p-3 transition-colors ${
                        !session.endedAt 
                          ? 'bg-green-50/20 hover:bg-green-50/30 border-l-4 border-l-green-500' 
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      {/* Content Title */}
                      <div className="overflow-hidden">
                        <div className="font-medium break-words">
                          {formatTitle(session)}
                        </div>
                        {session.year && (
                          <div className="text-xs text-muted-foreground">
                            {session.year}
                          </div>
                        )}
                      </div>

                      {/* Device */}
                      <div className="overflow-hidden">
                        <div className="text-sm break-words">
                          {getDeviceDisplayName(session)}
                        </div>
                      </div>

                      {/* Platform */}
                      <div className="overflow-hidden">
                        {session.userDevice?.devicePlatform && (
                          <div className="text-xs text-muted-foreground capitalize">
                            {session.userDevice.devicePlatform}
                          </div>
                        )}
                      </div>

                      {/* IP Address */}
                      <div className="overflow-hidden">
                        <div className="text-sm font-mono">
                          <ClickableIP ipAddress={session.deviceAddress} />
                        </div>
                      </div>

                      {/* Started */}
                      <div className="overflow-hidden">
                        <div className="text-sm">
                          {formatDate(session.startedAt)}
                        </div>
                      </div>

                      {/* Ended */}
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1 text-sm">
                          {session.endedAt ? (
                            <span>{formatDate(session.endedAt)}</span>
                          ) : (
                            <>
                              <Radio className="w-3 h-3 text-green-500 animate-pulse flex-shrink-0" />
                              <span className="text-green-700 font-medium">Active</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="overflow-hidden">
                        <div className="text-sm font-mono">
                          {formatDuration(session)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-start gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeviceClick(session)}
                          className="h-8 w-8 p-0"
                          title="Scroll to Device"
                        >
                          <UserRoundSearch className="w-4 h-4" />
                        </Button>
                        {/* Only show delete button for completed sessions */}
                        {session.endedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(session)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {filteredSessions.map((session) => (
                    <Card 
                      key={session.id} 
                      className={`p-4 transition-colors ${
                        !session.endedAt 
                          ? 'bg-green-50/20 hover:bg-green-50/30 border-l-4 border-l-green-500' 
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      {/* Title and Active Status */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm break-words">
                            {formatTitle(session)}
                          </div>
                          {session.year && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {session.year}
                            </div>
                          )}
                        </div>
                        {!session.endedAt && (
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <Radio className="w-3 h-3 text-green-500 animate-pulse" />
                            <span className="text-xs text-green-700 font-medium">Active</span>
                          </div>
                        )}
                      </div>

                      {/* Device and Platform */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Device:</span>
                          <span className="text-sm break-words text-right max-w-[60%]">
                            {getDeviceDisplayName(session)}
                          </span>
                        </div>
                        {session.userDevice?.devicePlatform && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Platform:</span>
                            <span className="text-sm capitalize">
                              {session.userDevice.devicePlatform}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Timing Information */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Started:</span>
                          <span className="text-sm break-words text-right max-w-[60%]">
                            {formatDate(session.startedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Ended:</span>
                          <span className="text-sm break-words text-right max-w-[60%]">
                            {session.endedAt ? formatDate(session.endedAt) : 'Active Now'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Duration:</span>
                          <span className="text-sm font-mono">
                            {formatDuration(session)}
                          </span>
                        </div>
                      </div>

                      {/* IP Address */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-muted-foreground">IP Address:</span>
                        <div className="text-sm font-mono">
                          <ClickableIP ipAddress={session.deviceAddress} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeviceClick(session)}
                          className="h-8 px-3 text-xs"
                          title="Scroll to Device"
                        >
                          <UserRoundSearch className="w-3 h-3 mr-1" />
                          Find Device
                        </Button>
                        {/* Only show delete button for completed sessions */}
                        {session.endedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(session)}
                            className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete Session"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer Info */}
          {!loading && filteredSessions.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Showing {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!sessionToDelete}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Session History"
        description={
          sessionToDelete 
            ? `Are you sure you want to delete this session history for "${formatTitle(sessionToDelete)}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </Dialog>
  );
};