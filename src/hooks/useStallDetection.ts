/* Stall detection hook — detects when the event stream goes silent, indicating
 * Claude may be waiting for user input (permission, feedback, etc.). */

import { useState, useEffect, useRef } from "react";

/** Seconds of silence before reporting a stall. */
const STALL_THRESHOLD_SECONDS = 15;

/** Check interval in milliseconds. */
const CHECK_INTERVAL_MS = 3000;

/**
 * Returns true when the event stream has been silent for more than
 * the configured threshold while a session is active.
 *
 * @param lastEventAt - Timestamp of the last received event (ms since epoch)
 * @param isActive - Whether the session is currently active (running)
 * @param thresholdSeconds - Seconds of silence before reporting a stall (default: STALL_THRESHOLD_SECONDS)
 */
export function useStallDetection(lastEventAt: number, isActive: boolean, thresholdSeconds?: number): boolean {
  const threshold = thresholdSeconds ?? STALL_THRESHOLD_SECONDS;
  const [isStalled, setIsStalled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setIsStalled(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastEventAt) / 1000;
      if (elapsed >= threshold && lastEventAt > 0) {
        setIsStalled(true);
      } else {
        setIsStalled(false);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, lastEventAt, threshold]);

  return isStalled;
}
