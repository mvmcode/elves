/* useAutoInteractive — auto-transitions to interactive mode when a stall is
 * detected and the autoInteractiveOnStall setting is enabled. */

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { useStallDetection } from "@/hooks/useStallDetection";
import { transitionToInteractive } from "@/lib/tauri";

/**
 * Watches for stall conditions and automatically transitions to interactive
 * mode when the `autoInteractiveOnStall` setting is enabled.
 *
 * Wire this into Shell.tsx so it runs for the lifetime of the app.
 */
export function useAutoInteractive(): void {
  const activeSession = useSessionStore((s) => s.activeSession);
  const isInteractiveMode = useSessionStore((s) => s.isInteractiveMode);
  const lastEventAt = useSessionStore((s) => s.lastEventAt);
  const autoInteractiveOnStall = useSettingsStore((s) => s.autoInteractiveOnStall);
  const stallThresholdSeconds = useSettingsStore((s) => s.stallThresholdSeconds);

  const isActive = activeSession?.status === "active";
  const isStalled = useStallDetection(lastEventAt, isActive === true && !isInteractiveMode, stallThresholdSeconds);

  /** Guard against triggering more than once per stall episode. */
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isStalled) {
      hasTriggeredRef.current = false;
      return;
    }

    if (
      isStalled &&
      autoInteractiveOnStall &&
      isActive &&
      !isInteractiveMode &&
      !hasTriggeredRef.current &&
      activeSession
    ) {
      hasTriggeredRef.current = true;
      transitionToInteractive(activeSession.id).catch((error: unknown) => {
        console.error("useAutoInteractive: failed to transition:", error);
      });
    }
  }, [isStalled, autoInteractiveOnStall, isActive, isInteractiveMode, activeSession]);
}
