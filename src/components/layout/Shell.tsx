/* App shell — IDE-like layout with icon sidebar, command palette, top tabs, and status bar.
 * Inspired by Cursor/VS Code: narrow icon bar left, tabs + palette + content center, status bottom. */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TaskBar } from "./TaskBar";
import { FloorBar } from "./FloorBar";
import { StatusBar } from "./StatusBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ElfTheater } from "@/components/theater/ElfTheater";
import { WorkshopCanvas } from "@/components/workshop/WorkshopCanvas";
import { WorkshopOverlay } from "@/components/workshop/WorkshopOverlay";
import { SessionControlCard } from "@/components/session/SessionControlCard";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { PlanPreview } from "@/components/theater/PlanPreview";
import { TaskGraph } from "@/components/theater/TaskGraph";
import { ThinkingPanel } from "@/components/theater/ThinkingPanel";
import { MemoryExplorer } from "@/components/memory/MemoryExplorer";
import { MemorySettings } from "@/components/settings/MemorySettings";
import ThemePicker from "@/components/settings/ThemePicker";
import { SkillEditor } from "@/components/editors/SkillEditor";
import { McpManager } from "@/components/editors/McpManager";
import { SessionHistory } from "@/components/project/SessionHistory";
import { BottomTerminalPanel } from "@/components/terminal/BottomTerminalPanel";
import { ShortcutOverlay } from "@/components/shared/ShortcutOverlay";
import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { ResizeHandle } from "@/components/shared/ResizeHandle";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useTeamSession } from "@/hooks/useTeamSession";
import { useMemoryActions } from "@/hooks/useMemoryActions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionEvents } from "@/hooks/useSessionEvents";
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
 * │ 🧠 │  Main Content Area               │
 * │ ⚡ │   (Workshop/Theater/Memory/etc)   │
 * │ 🔌 │                  ActivityFeed    │
 * │ 📜 │──────────────────────────────────│
 * │ ⚙  │  StatusBar (bottom)              │
 * └────┴──────────────────────────────────┘
 */
export function Shell(): React.JSX.Element {
  const activeView = useUiStore((state) => state.activeView);
  const isNewProjectDialogOpen = useUiStore((state) => state.isNewProjectDialogOpen);
  const setNewProjectDialogOpen = useUiStore((state) => state.setNewProjectDialogOpen);
  const activityFeedWidth = useUiStore((state) => state.activityFeedWidth);
  const setActivityFeedWidth = useUiStore((state) => state.setActivityFeedWidth);
  const isActivityFeedVisible = useUiStore((state) => state.isActivityFeedVisible);
  const toggleActivityFeed = useUiStore((state) => state.toggleActivityFeed);
  const activeSession = useSessionStore((state) => state.activeSession);
  const elves = useSessionStore((state) => state.elves);
  const events = useSessionStore((state) => state.events);
  const thinkingStream = useSessionStore((state) => state.thinkingStream);
  const isPlanPreview = useSessionStore((state) => state.isPlanPreview);
  const pendingPlan = useSessionStore((state) => state.pendingPlan);
  const isHistoricalFloor = useSessionStore(
    (state) => (state.activeFloorId ? state.floors[state.activeFloorId]?.isHistorical : false) ?? false,
  );
  const isTerminalPanelOpen = useUiStore((state) => state.isTerminalPanelOpen);
  const workshopViewMode = useUiStore((state) => state.workshopViewMode);
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

  /* Global Space key listener for toggling workshop/card view.
   * Lives here (not in WorkshopCanvas) so it works from both views. */
  useEffect(() => {
    function handleSpaceToggle(event: KeyboardEvent): void {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (activeView !== "session" || !activeSession) return;
      if (isPlanPreview) return;
      event.preventDefault();
      useUiStore.getState().toggleWorkshopViewMode();
    }
    window.addEventListener("keydown", handleSpaceToggle);
    return () => window.removeEventListener("keydown", handleSpaceToggle);
  }, [activeView, activeSession, isPlanPreview]);

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
      "menu:toggle_workshop": () => useUiStore.getState().toggleWorkshopViewMode(),
      "menu:toggle_activity": () => useUiStore.getState().toggleActivityFeed(),
      "menu:toggle_terminal": () => useUiStore.getState().toggleTerminalPanel(),
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

  const feedResize = useResizable({
    initialWidth: activityFeedWidth,
    onWidthChange: setActivityFeedWidth,
    minWidth: 280,
    maxWidth: 600,
    side: "left",
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

  const [isThinkingVisible, setIsThinkingVisible] = useState(false);

  const handleToggleThinking = useCallback((): void => {
    setIsThinkingVisible((prev) => !prev);
  }, []);

  const handleDeploy = useCallback(
    (plan: Parameters<typeof deployWithPlan>[0]): void => {
      play("deploy");
      void deployWithPlan(plan);
    },
    [deployWithPlan, play],
  );

  /** Whether the session completed successfully (elves in "done" or "sleeping" state) */
  const isCompleted =
    activeSession?.status === "completed" && elves.length > 0;

  /** Whether this is a team session with a task graph */
  const hasTaskGraph =
    activeSession?.plan != null &&
    activeSession.plan.complexity === "team" &&
    activeSession.plan.taskGraph.length > 0;

  /** Lead elf ID for crown badge */
  const leadElfId = elves.length > 0 ? elves[0]?.id : undefined;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-light">
      {/* Icon sidebar — narrow left strip */}
      <Sidebar />

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Command palette / TaskBar */}
        <TaskBar />

        {/* Floor tabs — at top, like editor tabs */}
        <FloorBar />

        {/* View routing — session workshop, memory, skills, MCP, history, settings */}
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
        ) : activeView === "settings" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <ThemePicker />
            <div className="border-t-token-normal border-border" />
            <MemorySettings
              onClearAll={handleClearAll}
              onExport={handleExportMemories}
              onImport={handleImportMemories}
            />
          </div>
        ) : (
          <>
            {/* Plan Preview phase — shown before deployment for team tasks */}
            {isPlanPreview && pendingPlan && (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <PlanPreview plan={pendingPlan} onDeploy={handleDeploy} />
              </div>
            )}

            {/* Active session — show ElfTheater, TaskGraph, ThinkingPanel, SessionControlCard */}
            {!isPlanPreview && activeSession ? (
              <div className="relative flex flex-1 overflow-hidden">
                {/* Center — elf workshop + task graph + thinking panel */}
                <div className="flex flex-1 flex-col overflow-y-auto">
                  {/* Celebration banner on completion */}
                  <AnimatePresence>
                    {isCompleted && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="border-b-token-normal border-border bg-success px-6 py-3 text-center"
                        data-testid="celebration-banner"
                      >
                        <p className="font-display text-xl text-heading tracking-wide text-white">
                          All Done!
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Workshop view (pixel art) or Card view — toggled via Space */}
                  {workshopViewMode === "workshop" && !isHistoricalFloor ? (
                    <div className="relative flex flex-1 overflow-hidden">
                      <WorkshopCanvas elves={elves} events={events} />
                      <WorkshopOverlay
                        elves={elves}
                        events={events}
                        startedAt={activeSession.startedAt}
                        tasksDone={0}
                        tasksTotal={0}
                      />
                    </div>
                  ) : (
                    <ElfTheater
                      elves={elves}
                      events={events}
                      leadElfId={leadElfId}
                      startedAt={activeSession.startedAt}
                      sessionStatus={activeSession.status}
                      isHistorical={isHistoricalFloor}
                    />
                  )}

                  {/* Task Graph — shown for team sessions */}
                  {hasTaskGraph && activeSession.plan && (
                    <div className="border-t-token-normal border-border px-4 py-4">
                      <h3 className="mb-2 font-display text-sm text-label text-text-muted-light">
                        Task Graph
                      </h3>
                      <TaskGraph nodes={activeSession.plan.taskGraph} />
                    </div>
                  )}

                  {/* Thinking Panel — shown for team sessions */}
                  {hasTaskGraph && (
                    <div className="border-t-token-normal border-border px-4 py-3">
                      <ThinkingPanel
                        thoughts={thinkingStream}
                        isVisible={isThinkingVisible}
                        onToggle={handleToggleThinking}
                      />
                    </div>
                  )}
                </div>

                {/* Activity feed overlay (Cmd+B) — absolute positioned, does not push layout */}
                {isActivityFeedVisible && (
                  <div
                    className="absolute right-0 top-0 z-20 h-full border-l-[2px] border-border bg-surface-elevated shadow-brutal-lg"
                    style={{ width: activityFeedWidth }}
                  >
                    <ResizeHandle
                      side="left"
                      onMouseDown={feedResize.handleProps.onMouseDown}
                      isDragging={feedResize.isDragging}
                    />
                    <div className="flex h-full flex-col">
                      <div className="flex items-center justify-between border-b-[2px] border-border px-3 py-2">
                        <h3 className="font-display text-xs text-label">Activity</h3>
                        <button
                          onClick={toggleActivityFeed}
                          className="cursor-pointer border-none bg-transparent p-1 font-mono text-xs font-bold text-text-light/40 hover:text-text-light"
                          title="Close activity feed (Cmd+B)"
                        >
                          {"\u00BB"}
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <ActivityFeed events={events} maxHeight="100%" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating session control card */}
                <SessionControlCard />
              </div>
            ) : (
              /* Empty state — no session and not in plan preview */
              !isPlanPreview && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Completion summary card — shown briefly after a session completes */}
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
                  {!completedSummary && (
                    <EmptyState
                      message="Your elves are bored. Give them something to do."
                      submessage="Type a task above and summon the elves to get started."
                    />
                  )}
                </div>
              )
            )}
          </>
        )}

        {/* Bottom terminal panel — slides up when toggled from SessionControlCard */}
        {isTerminalPanelOpen && <BottomTerminalPanel />}

        {/* Shortcut overlay — toggled via Cmd+/ */}
        <ShortcutOverlay isOpen={shortcutOverlayOpen} onClose={toggleOverlay} />

        {/* Status bar — always visible at bottom */}
        <StatusBar />
      </main>

      {/* New project creation dialog */}
      <NewProjectDialog
        isOpen={isNewProjectDialogOpen}
        onClose={() => setNewProjectDialogOpen(false)}
      />
    </div>
  );
}
