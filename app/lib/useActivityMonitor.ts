import { useEffect, useRef, useState, useCallback } from 'react';
import { INACTIVITY_THRESHOLD_MS, ACTIVITY_GRACE_PERIOD_MS } from './config';

export type ActivityStatus = 
  | 'ACTIVE' 
  | 'INACTIVE' 
  | 'TAB_AWAY' 
  | 'BACKGROUND' 
  | 'POSSIBLE_EXTERNAL_ACTIVITY';

export interface ActivityMonitorOptions {
  onStatusChange: (status: ActivityStatus, durationAwayMs?: number, previousStatus?: ActivityStatus) => void;
  enabled?: boolean;
}

export function useActivityMonitor({ onStatusChange, enabled = true }: ActivityMonitorOptions) {
  const [currentStatus, setCurrentStatus] = useState<ActivityStatus>('ACTIVE');
  const statusRef = useRef<ActivityStatus>('ACTIVE');
  const onStatusChangeRef = useRef(onStatusChange);
  
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const lastActivityTime = useRef<number>(Date.now());
  const awayStartTime = useRef<number | null>(null);
  const inactiveTimer = useRef<NodeJS.Timeout | null>(null);
  const graceTimer = useRef<NodeJS.Timeout | null>(null);

  const updateStatus = useCallback((newStatus: ActivityStatus) => {
    if (newStatus === statusRef.current) return;

    let durationAwayMs = 0;
    if (newStatus === 'ACTIVE' && awayStartTime.current) {
      durationAwayMs = Date.now() - awayStartTime.current;
      awayStartTime.current = null;
    } else if (newStatus !== 'ACTIVE' && statusRef.current === 'ACTIVE') {
      awayStartTime.current = Date.now();
    }

    const previousStatus = statusRef.current;
    statusRef.current = newStatus;
    setCurrentStatus(newStatus);
    if (onStatusChangeRef.current) {
        onStatusChangeRef.current(newStatus, durationAwayMs, previousStatus);
    }
  }, []);

  const handleUserActivity = useCallback(() => {
    if (!enabled) return;
    
    lastActivityTime.current = Date.now();
    
    if (statusRef.current === 'INACTIVE') {
      updateStatus('ACTIVE');
    }

    if (inactiveTimer.current) {
      clearTimeout(inactiveTimer.current);
    }
    
    if (statusRef.current !== 'TAB_AWAY' && statusRef.current !== 'BACKGROUND' && statusRef.current !== 'POSSIBLE_EXTERNAL_ACTIVITY') {
       inactiveTimer.current = setTimeout(() => {
         updateStatus('INACTIVE');
       }, INACTIVITY_THRESHOLD_MS);
    }
  }, [enabled, updateStatus]);

  useEffect(() => {
    if (!enabled) return;

    // Throttle high-frequency events
    let ticking = false;
    const throttledHandleActivity = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleUserActivity();
          ticking = false;
        });
        ticking = true;
      }
    };

    // User interaction listeners
    window.addEventListener('mousemove', throttledHandleActivity, { passive: true });
    window.addEventListener('mousedown', throttledHandleActivity, { passive: true });
    window.addEventListener('keydown', throttledHandleActivity, { passive: true });
    window.addEventListener('touchstart', throttledHandleActivity, { passive: true });
    window.addEventListener('wheel', throttledHandleActivity, { passive: true });

    // Initial inactivity timer
    handleUserActivity();

    return () => {
      window.removeEventListener('mousemove', throttledHandleActivity);
      window.removeEventListener('mousedown', throttledHandleActivity);
      window.removeEventListener('keydown', throttledHandleActivity);
      window.removeEventListener('touchstart', throttledHandleActivity);
      window.removeEventListener('wheel', throttledHandleActivity);
      if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
      if (graceTimer.current) clearTimeout(graceTimer.current);
    };
  }, [enabled, handleUserActivity]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
        updateStatus('POSSIBLE_EXTERNAL_ACTIVITY');
      } else {
        handleUserActivity(); // Reset activity when they come back
        updateStatus('ACTIVE');
      }
    };

    const handleBlur = () => {
      if (document.visibilityState !== 'hidden') {
        if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
        updateStatus('TAB_AWAY');
      }
    };

    const handleFocus = () => {
       handleUserActivity();
       updateStatus('ACTIVE');
    };

    // Handle mobile/app backgrounding if supported (PWA lifecycle)
    const handleBackground = () => {
        if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
        updateStatus('BACKGROUND');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    // PageLifecycle / generic background events
    window.addEventListener('pagehide', handleBackground);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handleBackground);
    };
  }, [enabled, updateStatus, handleUserActivity]);

  return {
    currentStatus
  };
}
