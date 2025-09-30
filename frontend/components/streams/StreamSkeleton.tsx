import React from 'react';

// Stream skeleton for loading states
export const StreamSkeleton = () => (
  <div className="relative p-3 sm:p-4 rounded-lg border bg-card shadow-sm animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-5 bg-muted rounded w-48"></div>
        </div>
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-24"></div>
        </div>
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-32"></div>
        </div>
        <div className="w-full bg-muted rounded h-2 mb-2"></div>
        <div className="h-3 bg-muted rounded w-20"></div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-8 bg-muted rounded w-20"></div>
        <div className="h-6 bg-muted rounded w-16"></div>
      </div>
    </div>
  </div>
);