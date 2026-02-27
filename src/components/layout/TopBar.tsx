/* Top bar — runtime status indicators, runtime picker, terminal button, and global actions. */

import { useCallback } from "react";
import { useAppStore } from "@/stores/app";
import { useSessionStore } from "@/stores/session";
import { useProjectStore } from "@/stores/project";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { RuntimePicker } from "@/components/shared/RuntimePicker";
import { openProjectTerminal } from "@/lib/tauri";
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
  const claudeSessionId = useSessionStore((s) => s.activeSession?.claudeSessionId);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const handleRuntimeChange = useCallback(
    (runtime: Runtime): void => {
      setDefaultRuntime(runtime);
    },
    [setDefaultRuntime],
  );

  const handleOpenTerminal = useCallback((): void => {
    if (activeProject?.path) {
      void openProjectTerminal(activeProject.path, claudeSessionId ?? undefined);
    }
  }, [activeProject, claudeSessionId]);

  return (
    <header className="no-select flex h-14 items-center justify-between border-b-[3px] border-border px-6">
      <span className="font-body text-sm font-bold uppercase tracking-widest text-text-light/60">
        Deploy Your AI Army
      </span>

      {/* Runtime picker + terminal button + status indicators */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="px-3 py-1 text-xs font-mono"
          onClick={handleOpenTerminal}
          disabled={activeProject === null}
          title="Open terminal in project directory"
        >
          {">_"}
        </Button>
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
