/* Top bar — runtime status indicators and global actions. */

import { useAppStore } from "@/stores/app";
import { Badge } from "@/components/shared/Badge";

/**
 * Horizontal bar at the top of the main content area.
 * Shows detected runtime status and provides global action buttons.
 */
export function TopBar(): React.JSX.Element {
  const runtimes = useAppStore((s) => s.runtimes);

  return (
    <header className="no-select flex h-14 items-center justify-between border-b-[3px] border-border px-6">
      <span className="font-body text-sm font-bold uppercase tracking-widest text-text-light/60">
        Deploy Your AI Army
      </span>

      {/* Runtime indicators */}
      <div className="flex items-center gap-2">
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
