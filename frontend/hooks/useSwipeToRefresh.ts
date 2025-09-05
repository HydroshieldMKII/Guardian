import { useRef, useCallback } from 'react';

interface SwipeToRefreshOptions {
  onRefresh: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeToRefresh({
  onRefresh,
  threshold = 100,
  enabled = true,
}: SwipeToRefreshOptions) {
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isTracking = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    startY.current = touch.clientY;
    currentY.current = touch.clientY;
    isTracking.current = true;
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !isTracking.current) return;
    
    const touch = e.touches[0];
    currentY.current = touch.clientY;
    
    // Only track downward swipes at the top of the page
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > 0) {
      isTracking.current = false;
      return;
    }
    
    const deltaY = currentY.current - startY.current;
    if (deltaY > 0 && deltaY < threshold * 2) {
      // Prevent default scrolling behavior during pull
      e.preventDefault();
    }
  }, [enabled, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !isTracking.current) return;
    
    const deltaY = currentY.current - startY.current;
    
    if (deltaY > threshold) {
      onRefresh();
    }
    
    isTracking.current = false;
    startY.current = 0;
    currentY.current = 0;
  }, [enabled, threshold, onRefresh]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
