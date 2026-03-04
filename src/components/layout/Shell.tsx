/* App shell — IDE-like layout with icon sidebar, command palette, top tabs, and status bar.
 * PTY-first: session view uses SessionSplitView (elf panel + live terminal). */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TaskBar } from "./TaskBar";
import { FloorBar } from "./FloorBar";
import { StatusBar } from "./StatusBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SessionSplitView } from "@/components/session/SessionSplitView";
/* SessionControlCard removed — controls are now inline in SessionSplitView as SessionControlPill */
import { PlanPreview } from "@/components/theater/PlanPreview";
import { MemoryExplorer } from "@/components/memory/MemoryExplorer";
import { SettingsView } from "@/components/settings/SettingsView";
import { SkillEditor } from "@/components/editors/SkillEditor";
import { McpManager } from "@/components/editors/McpManager";
import { SessionHistory } from "@/components/project/SessionHistory";
import { SessionComparison } from "@/components/project/SessionComparison";
import { FileTreePanel } from "@/components/files/FileTreePanel";
import { FileViewer } from "@/components/files/FileViewer";
import { ShortcutOverlay } from "@/components/shared/ShortcutOverlay";
import { ToastContainer } from "@/components/shared/Toast";
import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { ResizeHandle } from "@/components/shared/ResizeHandle";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useTeamSession } from "@/hooks/useTeamSession";
import { useMemoryActions } from "@/hooks/useMemoryActions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionEvents } from "@/hooks/useSessionEvents";
import { useProjectContext } from "@/hooks/useProjectContext";
import { useSounds } from "@/hooks/useSounds";
import { useResizable } from "@/hooks/useResizable";
import { onEvent } from "@/lib/tauri";

/**
 * Root layout shell — IDE-like structure:
 * ┌────┬──────────────────────────────────┐
 * │Icon│  TaskBar (command palette)        │
 * │Bar │──────────────────────────────────│
 * │    │  FloorBar (tabs)                 │
 * │ ⚒  │──────────────────────────────────│
 * │ 🧠 │  SessionSplitView                │
 * │ ⚡ │   (Elf Panel | PTY Terminal)      │
 * │ 🔌 │                                  │
 * │ 📜 │──────────────────────────────────│
 * │ ⚙  │  StatusBar (bottom)              │
 * └────┴──────────────────────────────────┘
 */
export function Shell(): React.JSX.Element {
  const activeView = useUiStore((state) => state.activeView);
  const isNewProjectDialogOpen = useUiStore((state) => state.isNewProjectDialogOpen);
  const setNewProjectDialogOpen = useUiStore((state) => state.setNewProjectDialogOpen);
  const activeSession = useSessionStore((state) => state.activeSession);
  const isPlanPreview = useSessionStore((state) => state.isPlanPreview);
  const pendingPlan = useSessionStore((state) => state.pendingPlan);
  const isFileTreeVisible = useUiStore((state) => state.isFileTreeVisible);
  const fileTreeWidth = useUiStore((state) => state.fileTreeWidth);
  const setFileTreeWidth = useUiStore((state) => state.setFileTreeWidth);
  const selectedFilePath = useUiStore((state) => state.selectedFilePath);
  const { deployWithPlan, stopSession } = useTeamSession();
  const {
    handleCreateMemory,
    handleEditMemory,
    handlePinMemory,
    handleDeleteMemory,
    handleSearch,
    handleClearAll,
    handleExportMemories,
    handleImportMemories,
  } = useMemoryActions();
  const { play } = useSounds();
  const { shortcutOverlayOpen, toggleOverlay } = useKeyboardShortcuts({
    onCancelTask: () => void stopSession(),
  });

  /* Subscribe to Tauri backend events (elf:event, session:completed) */
  useSessionEvents();

  /* Load project-scoped context (git state, etc.) when active project changes */
  useProjectContext();

  /* Listen for native menu events from Tauri backend */
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const menuEvents: Record<string, () => void> = {
      "menu:new_floor": () => useSessionStore.getState().createFloor(),
      "menu:close_floor": () => {
        const store = useSessionStore.getState();
        const floorId = store.activeFloorId;
        if (floorId && store.floors[floorId]?.session?.status !== "active") {
          store.closeFloor(floorId);
        }
      },
      "menu:toggle_settings": () => {
        const store = useUiStore.getState();
        store.setActiveView(store.activeView === "settings" ? "session" : "settings");
      },
      "menu:keyboard_shortcuts": () => toggleOverlay(),
    };

    for (const [eventName, handler] of Object.entries(menuEvents)) {
      onEvent(eventName, handler)
        .then((unsub) => cleanups.push(unsub))
        .catch((error: unknown) => console.error(`Failed to subscribe to ${eventName}:`, error));
    }

    return () => cleanups.forEach((unsub) => unsub());
  }, [toggleOverlay]);

  const fileTreeResize = useResizable({
    initialWidth: fileTreeWidth,
    onWidthChange: setFileTreeWidth,
    minWidth: 180,
    maxWidth: 400,
    side: "right",
  });

  /** Snapshot of a completed session shown in the summary card before the session clears. */
  interface CompletedSessionSummary {
    readonly id: string;
    readonly task: string;
    readonly elapsed: number;
    readonly cost: number;
  }

  const [completedSummary, setCompletedSummary] = useState<CompletedSessionSummary | null>(null);
  const prevSessionRef = useRef<typeof activeSession>(null);

  /** Capture session info when it transitions away (completed session gets cleared immediately). */
  useEffect(() => {
    const prev = prevSessionRef.current;
    if (prev && prev.status === "completed" && !activeSession) {
      const elapsed = Math.floor((Date.now() - prev.startedAt) / 1000);
      setCompletedSummary({
        id: prev.id,
        task: prev.task,
        elapsed,
        cost: 0,
      });
    }
    prevSessionRef.current = activeSession;
  }, [activeSession]);

  /** Auto-dismiss the completion summary after 10 seconds. */
  useEffect(() => {
    if (!completedSummary) return;
    const timer = setTimeout(() => setCompletedSummary(null), 10000);
    return () => clearTimeout(timer);
  }, [completedSummary]);

  const setHighlightedSessionId = useUiStore((state) => state.setHighlightedSessionId);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const handleViewInHistory = useCallback((): void => {
    if (!completedSummary) return;
    setHighlightedSessionId(completedSummary.id);
    setActiveView("history");
    setCompletedSummary(null);
  }, [completedSummary, setHighlightedSessionId, setActiveView]);

  const handleNewTask = useCallback((): void => {
    setCompletedSummary(null);
  }, []);

  const handleDeploy = useCallback(
    (plan: Parameters<typeof deployWithPlan>[0]): void => {
      play("deploy");
      void deployWithPlan(plan);
    },
    [deployWithPlan, play],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-light">
      {/* Icon sidebar */}
      <Sidebar />

      {/* File tree panel */}
      {isFileTreeVisible && (
        <div className="relative flex h-full shrink-0">
          <FileTreePanel />
          <ResizeHandle
            side="right"
            onMouseDown={fileTreeResize.handleProps.onMouseDown}
            isDragging={fileTreeResize.isDragging}
          />
        </div>
      )}

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Command palette / TaskBar */}
        <TaskBar />

        {/* Floor tabs */}
        <FloorBar />

        {/* View routing */}
        {activeView === "memory" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <MemoryExplorer
              onCreateMemory={handleCreateMemory}
              onEditMemory={handleEditMemory}
              onPinMemory={handlePinMemory}
              onDeleteMemory={handleDeleteMemory}
              onSearch={handleSearch}
            />
          </div>
        ) : activeView === "skills" ? (
          <div className="flex flex-1 overflow-hidden">
            <SkillEditor />
          </div>
        ) : activeView === "mcp" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <McpManager />
          </div>
        ) : activeView === "history" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <SessionHistory />
          </div>
        ) : activeView === "comparison" ? (
          <div className="flex flex-1 overflow-hidden">
            <SessionComparison />
          </div>
        ) : activeView === "settings" ? (
          <SettingsView
            onClearAll={handleClearAll}
            onExport={handleExportMemories}
            onImport={handleImportMemories}
          />
        ) : (
          <>
            {/* Plan Preview phase — shown before deployment for team tasks */}
            {isPlanPreview && pendingPlan && (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <PlanPreview plan={pendingPlan} onDeploy={handleDeploy} />
              </div>
            )}

            {/* Active session — workshop-first view with inline controls */}
            {!isPlanPreview && activeSession ? (
              <div className="relative flex flex-1 overflow-hidden">
                <SessionSplitView />
              </div>
            ) : (
              /* Empty state — no session and not in plan preview */
              !isPlanPreview && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Completion summary card */}
                  <AnimatePresence>
                    {completedSummary && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="mx-auto mt-8 w-full max-w-md border-token-normal border-border bg-surface-elevated p-6 shadow-brutal-lg rounded-token-md"
                        data-testid="completion-summary"
                      >
                        <div className="mb-4 border-b-token-normal border-border pb-3 text-center">
                          <p className="font-display text-3xl text-heading tracking-tight text-success">
                            All Done!
                          </p>
                          <p className="mt-1 font-body text-sm text-text-muted">
                            The elves have spoken. Task completed successfully.
                          </p>
                        </div>
                        <p className="mb-3 truncate font-body text-sm font-bold" title={completedSummary.task}>
                          {completedSummary.task}
                        </p>
                        <div className="mb-4 flex gap-4">
                          <div className="border-token-thin border-border/30 px-3 py-1">
                            <p className="font-mono text-xs text-text-muted-light">Elapsed</p>
                            <p className="font-mono text-sm font-bold">
                              {completedSummary.elapsed < 60
                                ? `${completedSummary.elapsed}s`
                                : `${Math.floor(completedSummary.elapsed / 60)}m ${String(completedSummary.elapsed % 60).padStart(2, "0")}s`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={handleViewInHistory}
                            className="flex-1 cursor-pointer border-token-normal border-border bg-accent text-accent-contrast px-4 py-2 font-display text-xs text-label shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none rounded-token-md"
                            data-testid="view-in-history-btn"
                          >
                            View in History
                          </button>
                          <button
                            onClick={handleNewTask}
                            className="flex-1 cursor-pointer border-token-normal border-border bg-surface-elevated px-4 py-2 font-display text-xs text-label shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none rounded-token-md"
                            data-testid="new-task-btn"
                          >
                            New Task
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!completedSummary && !selectedFilePath && (
                    <EmptyState
                      message="Your elves are bored. Give them something to do."
                      submessage="Type a task above and summon the elves to get started."
                    />
                  )}
                  {selectedFilePath && <FileViewer />}
                </div>
              )
            )}
          </>
        )}

        {/* Shortcut overlay — toggled via Cmd+/ */}
        <ShortcutOverlay isOpen={shortcutOverlayOpen} onClose={toggleOverlay} />

        {/* Status bar */}
        <StatusBar />
      </main>

      {/* New project creation dialog */}
      <NewProjectDialog
        isOpen={isNewProjectDialogOpen}
        onClose={() => setNewProjectDialogOpen(false)}
      />

      {/* Toast notification stack — fixed position, bottom-left */}
      <ToastContainer />
    </div>
  );
}
