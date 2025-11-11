import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Session Timeout Hook
 * Automatically logs out user after period of inactivity
 *
 * Security Features:
 * - Auto-logout after 30 minutes of inactivity
 * - Warning toast 2 minutes before logout
 * - Activity tracking on user interactions
 * - Cleanup on unmount
 *
 * @param timeout - Timeout in milliseconds (default: 30 minutes)
 * @param warningTime - Warning time before logout in ms (default: 2 minutes)
 */
export const useSessionTimeout = (
  timeout: number = 30 * 60 * 1000, // 30 minutes
  warningTime: number = 2 * 60 * 1000 // 2 minutes before
) => {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const warningShownRef = useRef(false);

  /**
   * Logout user and clear session
   */
  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      toast.error('Session expired due to inactivity. Please login again.');
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation even if signOut fails
      navigate('/auth');
    }
  }, [navigate]);

  /**
   * Show warning before logout
   */
  const showWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      toast.warning('Your session will expire in 2 minutes due to inactivity.', {
        duration: 5000,
      });
    }
  }, []);

  /**
   * Reset inactivity timer
   */
  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    // Reset warning flag
    warningShownRef.current = false;

    // Set warning timer
    warningRef.current = setTimeout(() => {
      showWarning();
    }, timeout - warningTime);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      logout();
    }, timeout);
  }, [timeout, warningTime, logout, showWarning]);

  /**
   * Activity event handler
   */
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is authenticated, start timer
        resetTimer();

        // Activity events to track
        const events = [
          'mousedown',
          'mousemove',
          'keypress',
          'scroll',
          'touchstart',
          'click',
        ];

        // Throttle activity handler to avoid too many resets
        let throttleTimeout: NodeJS.Timeout;
        const throttledHandler = () => {
          if (!throttleTimeout) {
            throttleTimeout = setTimeout(() => {
              handleActivity();
              clearTimeout(throttleTimeout);
              throttleTimeout = undefined as any;
            }, 1000); // Throttle to once per second
          }
        };

        // Add event listeners
        events.forEach((event) => {
          window.addEventListener(event, throttledHandler);
        });

        // Cleanup function
        return () => {
          events.forEach((event) => {
            window.removeEventListener(event, throttledHandler);
          });

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          if (warningRef.current) {
            clearTimeout(warningRef.current);
          }
          if (throttleTimeout) {
            clearTimeout(throttleTimeout);
          }
        };
      }
    };

    checkAuth();
  }, [resetTimer, handleActivity]);

  return {
    resetTimer, // Expose to manually reset if needed
  };
};
