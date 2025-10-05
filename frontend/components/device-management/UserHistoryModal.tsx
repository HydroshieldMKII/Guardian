import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Clock,
  Monitor,
  MapPin,
  Calendar,
  Play,
  Eye,
  X,
  ChevronRight,
  RefreshCw,
  Radio
} from "lucide-react";
import { config } from '@/lib/config';
import { ClickableIP } from './SharedComponents';

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
              <div className="divide-y min-w-max">
                {/* Header */}
                <div className="grid grid-cols-7 gap-4 p-3 bg-muted text-sm font-medium sticky top-0 z-10 min-w-[800px]">
                  <div className="flex-1 min-w-[200px]">Content</div>
                  <div className="flex-1 min-w-[120px]">Device</div>
                  <div className="flex-1 min-w-[80px]">Platform</div>
                  <div className="flex-1 min-w-[120px]">IP Address</div>
                  <div className="flex-1 min-w-[140px]">Started</div>
                  <div className="flex-1 min-w-[140px]">Ended</div>
                  <div className="flex-1 min-w-[80px]">Action</div>
                </div>

                {/* Session Rows */}
                {filteredSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className={`grid grid-cols-7 gap-4 p-3 transition-colors min-w-[800px] ${
                      !session.endedAt 
                        ? 'bg-green-50/20 hover:bg-green-50/30 border-l-4 border-l-green-500' 
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Content Title */}
                    <div className="flex-1 min-w-[200px] min-w-0">
                      <div className="font-medium truncate">
                        {formatTitle(session)}
                      </div>
                      {session.year && (
                        <div className="text-xs text-muted-foreground">
                          {session.year}
                        </div>
                      )}
                    </div>

                    {/* Device */}
                    <div className="flex-1 min-w-[120px] min-w-0">
                      <div className="truncate text-sm">
                        {getDeviceDisplayName(session)}
                      </div>
                    </div>

                    {/* Platform */}
                    <div className="flex-1 min-w-[80px] min-w-0">
                      {session.userDevice?.devicePlatform && (
                        <div className="text-xs text-muted-foreground capitalize truncate">
                          {session.userDevice.devicePlatform}
                        </div>
                      )}
                    </div>

                    {/* IP Address */}
                    <div className="flex-1 min-w-[120px] min-w-0">
                      <div className="text-sm font-mono truncate">
                        <ClickableIP ipAddress={session.deviceAddress} />
                      </div>
                    </div>

                    {/* Started */}
                    <div className="flex-1 min-w-[140px] min-w-0">
                      <div className="text-sm">
                        {formatDate(session.startedAt)}
                      </div>
                    </div>

                    {/* Ended */}
                    <div className="flex-1 min-w-[140px] min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        {session.endedAt ? (
                          formatDate(session.endedAt)
                        ) : (
                          <>
                            <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                            <span className="text-green-700 font-medium">Active Now</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex-1 min-w-[80px] flex justify-start">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeviceClick(session)}
                        className="h-8 w-8 p-0"
                        title="Scroll to Device"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
    </Dialog>
  );
};