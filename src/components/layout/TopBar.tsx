/* Top bar — runtime status indicators, runtime picker, and global actions. */

import { useCallback } from "react";
import { useAppStore } from "@/stores/app";
import { useSessionStore } from "@/stores/session";
import { Badge } from "@/components/shared/Badge";
import { RuntimePicker } from "@/components/shared/RuntimePicker";
import type { Runtime } from "@/types/elf";

/**
 * Horizontal bar at the top of the main content area.
 * Shows detected runtime status, runtime picker, and provides global action buttons.
 */
export function TopBar(): React.JSX.Element {
  const runtimes = useAppStore((s) => s.runtimes);
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const setDefaultRuntime = useAppStore((s) => s.setDefaultRuntime);
  const isSessionActive = useSessionStore((s) => s.activeSession !== null && s.activeSession.status === "active");

  const handleRuntimeChange = useCallback(
    (runtime: Runtime): void => {
      setDefaultRuntime(runtime);
    },
    [setDefaultRuntime],
  );

  return (
    <header className="no-select flex h-14 items-center justify-between border-b-token-normal border-border px-6">
      <span className="font-body text-sm text-label text-text-light/60">
        Deploy Your AI Army
      </span>

      {/* Runtime picker + status indicators */}
      <div className="flex items-center gap-3">
        {!isSessionActive && (
          <RuntimePicker
            value={defaultRuntime ?? "claude-code"}
            onChange={handleRuntimeChange}
            compact
          />
        )}
        {runtimes?.claudeCode ? (
          <Badge variant="success">Claude Code {runtimes.claudeCode.version}</Badge>
        ) : (
          <Badge variant="error">Claude Code N/A</Badge>
        )}
        {runtimes?.codex ? (
          <Badge variant="success">Codex {runtimes.codex.version}</Badge>
        ) : (
          <Badge variant="error">Codex N/A</Badge>
        )}
      </div>
    </header>
  );
}
