/* SplitPaneLayout — resizable side-by-side layout for files + workspace views.
 * Left panel: FileExplorerView, Right panel: children (ProjectWorkspace passed in).
 * Supports three modes: split (both visible), files-only, workspace-only.
 * Uses CSS hidden class for collapsed panels to preserve xterm terminal buffers. */

import { useCallback, useEffect, useRef } from "react";
import { FileExplorerView } from "@/components/files/FileExplorerView";
import { useUiStore } from "@/stores/ui";
import type { SplitPaneMode } from "@/stores/ui";

/** Minimum panel widths in pixels. */
const LEFT_MIN_PX = 250;
const RIGHT_MIN_PX = 300;

/** Icon for split mode (two columns). */
function IconColumns(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

/** Icon for files-only mode (single column with file). */
function IconFileOnly(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/** Icon for workspace-only mode (grid). */
function IconWorkspaceOnly(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

/** Mode label and icon mapping for the toolbar toggle. */
const MODE_CONFIG: Record<SplitPaneMode, { label: string; Icon: () => React.JSX.Element }> = {
  split: { label: "Split", Icon: IconColumns },
  "files-only": { label: "Files", Icon: IconFileOnly },
  "workspace-only": { label: "Workspace", Icon: IconWorkspaceOnly },
};

interface SplitPaneLayoutProps {
  /** Whether to show the file explorer panel. */
  readonly showFileExplorer: boolean;
  /** The workspace content (ProjectWorkspace) — passed in to keep a single React instance. */
  readonly children: React.ReactNode;
}

/**
 * Resizable split pane layout — file explorer on left, workspace on right.
 * Shell passes ProjectWorkspace as children so the terminal instance is never remounted.
 */
export function SplitPaneLayout({ showFileExplorer, children }: SplitPaneLayoutProps): React.JSX.Element {
  const splitPaneMode = useUiStore((s) => s.splitPaneMode);
  const splitPaneRatio = useUiStore((s) => s.splitPaneRatio);
  const setSplitPaneRatio = useUiStore((s) => s.setSplitPaneRatio);
  const setSplitPaneMode = useUiStore((s) => s.setSplitPaneMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startRatio: number } | null>(null);
  const ratioRef = useRef(splitPaneRatio);
  ratioRef.current = splitPaneRatio;

  /* Cleanup ref for in-flight drag — prevents leaked listeners on unmount. */
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const isSplit = showFileExplorer && splitPaneMode === "split";
  const showLeft = showFileExplorer && splitPaneMode !== "workspace-only";
  const showRight = !showFileExplorer || splitPaneMode !== "files-only";

  /* Drag handlers — convert pixel delta to ratio change. */
  const handleDragStart = useCallback(
    (event: React.MouseEvent): void => {
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startRatio: ratioRef.current };

      const container = containerRef.current;
      if (!container) return;

      const handleDragMove = (moveEvent: MouseEvent): void => {
        if (!dragRef.current || !container) return;
        const containerWidth = container.clientWidth;
        const deltaX = moveEvent.clientX - dragRef.current.startX;
        const deltaRatio = deltaX / containerWidth;
        const newRatio = dragRef.current.startRatio + deltaRatio;

        /* Clamp based on min pixel widths */
        const minRatio = LEFT_MIN_PX / containerWidth;
        const maxRatio = 1 - RIGHT_MIN_PX / containerWidth;
        setSplitPaneRatio(Math.min(maxRatio, Math.max(minRatio, newRatio)));
      };

      const handleDragEnd = (): void => {
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
        cleanupRef.current = null;
      };

      cleanupRef.current = handleDragEnd;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
    },
    [setSplitPaneRatio],
  );

  /* Double-click divider to reset to 50/50. */
  const handleDoubleClick = useCallback((): void => {
    setSplitPaneRatio(0.5);
  }, [setSplitPaneRatio]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar — split mode toggle (only visible when file explorer is active) */}
      <div className="flex shrink-0 items-center justify-between border-b-[3px] border-border bg-surface-elevated px-3 py-1.5"
           style={{ display: showFileExplorer ? "flex" : "none" }}>
        <span className="font-display text-xs font-bold uppercase tracking-wider text-text-light/50">
          {splitPaneMode === "split" ? "Files + Workspace" : splitPaneMode === "files-only" ? "Files" : "Workspace"}
        </span>

        <div className="flex items-center gap-1">
          {(["split", "files-only", "workspace-only"] as SplitPaneMode[]).map((mode) => {
            const config = MODE_CONFIG[mode];
            const isActive = splitPaneMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setSplitPaneMode(mode)}
                className={[
                  "flex cursor-pointer items-center gap-1.5 border-[2px] px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider transition-all duration-100",
                  isActive
                    ? "border-border bg-elf-gold text-text-light shadow-brutal-xs"
                    : "border-border/30 bg-transparent text-text-light/40 hover:border-border hover:text-text-light/70",
                ].join(" ")}
                title={config.label}
              >
                <config.Icon />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split content area */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left panel — FileExplorerView */}
        <div
          className={showLeft ? "flex h-full shrink-0 flex-col overflow-hidden" : "hidden"}
          style={isSplit && showLeft ? { width: `${splitPaneRatio * 100}%` } : !isSplit && showLeft ? { flex: 1 } : undefined}
        >
          <FileExplorerView />
        </div>

        {/* Divider — wider hit target (16px) with narrow visual line */}
        {isSplit && (
          <div
            className="group relative flex h-full w-4 shrink-0 cursor-col-resize items-center justify-center"
            onMouseDown={handleDragStart}
            onDoubleClick={handleDoubleClick}
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(splitPaneRatio * 100)}
            aria-valuemin={15}
            aria-valuemax={85}
            tabIndex={0}
            data-testid="split-pane-divider"
          >
            {/* Visual divider line */}
            <div className="h-full w-[3px] bg-border transition-colors duration-100 group-hover:bg-elf-gold/50 group-active:bg-elf-gold" />
            {/* Drag grip dots */}
            <div className="absolute flex flex-col gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
              <span className="block h-1 w-1 rounded-full bg-text-light/40" />
              <span className="block h-1 w-1 rounded-full bg-text-light/40" />
              <span className="block h-1 w-1 rounded-full bg-text-light/40" />
            </div>
          </div>
        )}

        {/* Right panel — workspace content (ProjectWorkspace passed as children) */}
        <div
          className={showRight ? "flex h-full min-w-0 flex-1 flex-col overflow-hidden" : "hidden"}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
