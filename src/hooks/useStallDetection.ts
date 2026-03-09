/* Stall detection hook — detects when the event stream goes silent, indicating
 * Claude may be waiting for user input (permission, feedback, etc.).
 *
 * Uses a ref for lastEventAt to avoid tearing down and recreating the interval
 * on every single event (which would happen hundreds of times per session). */

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
  const lastEventAtRef = useRef(lastEventAt);

  /* Keep ref in sync without triggering the interval effect.
   * The interval reads from the ref on each tick, so it always uses
   * the latest value without needing to be recreated. */
  lastEventAtRef.current = lastEventAt;

  /* Set up/tear down the polling interval only when isActive or threshold changes —
   * NOT when lastEventAt changes (the ref handles that). */
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
      const elapsed = (now - lastEventAtRef.current) / 1000;
      if (elapsed >= threshold && lastEventAtRef.current > 0) {
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
  }, [isActive, threshold]);

  return isStalled;
}
