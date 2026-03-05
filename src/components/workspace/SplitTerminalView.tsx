/* SplitTerminalView — tmux-style grid layout for team PTY terminals.
 * Renders one TerminalPane per role in a CSS grid with neo-brutalist dividers.
 * Supports focus mode: double-click a pane header to maximize it, Escape to unfocus. */

import { useCallback, useEffect, useState } from "react";
import { TerminalPane } from "./TerminalPane";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceInfo, TeamPtyEntry } from "@/types/workspace";

interface SplitTerminalViewProps {
  readonly workspace: WorkspaceInfo;
  readonly entries: readonly TeamPtyEntry[];
}

/** Compute CSS grid template based on pane count.
 * 1 → 1col | 2 → 2col | 3-4 → 2col | 5-6 → 3col */
function gridTemplate(count: number): { columns: string; rows: string } {
  if (count <= 1) return { columns: "1fr", rows: "1fr" };
  if (count === 2) return { columns: "1fr 1fr", rows: "1fr" };
  if (count <= 4) {
    const rows = Math.ceil(count / 2);
    return { columns: "1fr 1fr", rows: Array(rows).fill("1fr").join(" ") };
  }
  const rows = Math.ceil(count / 3);
  return { columns: "1fr 1fr 1fr", rows: Array(rows).fill("1fr").join(" ") };
}

/**
 * Renders a CSS grid of TerminalPanes for a team deployment.
 * Each pane is an independent interactive Claude PTY.
 * Footer has STOP ALL button and pane status summary.
 */
export function SplitTerminalView({ workspace, entries }: SplitTerminalViewProps): React.JSX.Element {
  const [focusedPtyId, setFocusedPtyId] = useState<string | null>(null);

  /** Escape key unfocuses the maximized pane. */
  useEffect(() => {
    if (!focusedPtyId) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setFocusedPtyId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedPtyId]);

  /** Toggle focus on a specific pane. */
  const handlePaneFocus = useCallback((ptyId: string): void => {
    setFocusedPtyId((current) => (current === ptyId ? null : ptyId));
  }, []);

  /** Kill all PTY processes. */
  const handleStopAll = useCallback((): void => {
    for (const entry of entries) {
      invoke<void>("kill_pty", { ptyId: entry.ptyId }).catch((error: unknown) => {
        console.error(`Failed to kill PTY for ${entry.role}:`, error);
      });
    }
  }, [entries]);

  const { columns, rows } = gridTemplate(entries.length);

  /** When a pane is focused, render only that pane full-size. */
  const visibleEntries = focusedPtyId
    ? entries.filter((e) => e.ptyId === focusedPtyId)
    : entries;

  const focusedGrid = focusedPtyId
    ? { columns: "1fr", rows: "1fr" }
    : { columns, rows };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#1A1A2E]" data-testid="split-terminal-view">
      {/* Grid of terminal panes */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: focusedGrid.columns,
          gridTemplateRows: focusedGrid.rows,
          gap: "3px",
          backgroundColor: "#000",
          padding: "3px",
        }}
      >
        {visibleEntries.map((entry, index) => (
          <TerminalPane
            key={entry.ptyId}
            ptyId={entry.ptyId}
            role={entry.role}
            roleIndex={entries.indexOf(entry) >= 0 ? entries.indexOf(entry) : index}
            workspaceSlug={workspace.slug}
            isFocused={focusedPtyId === entry.ptyId}
            onFocus={() => handlePaneFocus(entry.ptyId)}
          />
        ))}
      </div>

      {/* Footer bar */}
      <div className="flex shrink-0 items-center gap-3 border-t-[3px] border-border bg-surface-elevated px-4 py-2">
        <button
          onClick={handleStopAll}
          className="cursor-pointer border-[2px] border-border bg-error px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          data-testid="stop-all-btn"
        >
          Stop All
        </button>

        <span className="font-mono text-[10px] text-text-muted">
          {entries.length} pane{entries.length !== 1 ? "s" : ""}
        </span>

        {focusedPtyId && (
          <span className="font-mono text-[10px] text-elf-gold">
            FOCUSED — press ESC to show all
          </span>
        )}

        <span className="ml-auto font-mono text-[10px] text-text-muted">{workspace.branch}</span>
      </div>
    </div>
  );
}
