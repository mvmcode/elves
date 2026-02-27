/* App shell — top-level layout composing sidebar, top bar, task bar, and content area. */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TaskBar } from "./TaskBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ElfTheater } from "@/components/theater/ElfTheater";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { PlanPreview } from "@/components/theater/PlanPreview";
import { TaskGraph } from "@/components/theater/TaskGraph";
import { ThinkingPanel } from "@/components/theater/ThinkingPanel";
import { MemoryExplorer } from "@/components/memory/MemoryExplorer";
import { MemorySettings } from "@/components/settings/MemorySettings";
import { SkillEditor } from "@/components/editors/SkillEditor";
import { McpManager } from "@/components/editors/McpManager";
import { SessionHistory } from "@/components/project/SessionHistory";
import { SessionTerminal } from "@/components/terminal/SessionTerminal";
import { ShortcutOverlay } from "@/components/shared/ShortcutOverlay";
import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { ResizeHandle } from "@/components/shared/ResizeHandle";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useTeamSession } from "@/hooks/useTeamSession";
import { useMemoryActions } from "@/hooks/useMemoryActions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionEvents } from "@/hooks/useSessionEvents";
import { useSounds } from "@/hooks/useSounds";
import { useResizable } from "@/hooks/useResizable";

/**
 * Root layout shell matching the UI design from product plan Section 7.1.
 * Left sidebar + main area (top bar, task bar, center content, activity feed).
 * Routes between session workshop, memory, skills, MCP, history, and settings views.
 * Shows PlanPreview during plan phase, ElfTheater + TaskGraph + ThinkingPanel during
 * active sessions, celebration banner on completion, or empty state when idle.
 */
export function Shell(): React.JSX.Element {
  const activeView = useUiStore((state) => state.activeView);
  const isNewProjectDialogOpen = useUiStore((state) => state.isNewProjectDialogOpen);
  const setNewProjectDialogOpen = useUiStore((state) => state.setNewProjectDialogOpen);
  const sidebarWidth = useUiStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUiStore((state) => state.setSidebarWidth);
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
  const terminalSessionId = useUiStore((state) => state.terminalSessionId);
  const setTerminalSessionId = useUiStore((state) => state.setTerminalSessionId);
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const { deployWithPlan, stopSession } = useTeamSession();
  const {
    handleCreateMemory,
    handleEditMemory,
    handlePinMemory,
    handleDeleteMemory,
    handleSearch,
    handleClearAll,
  } = useMemoryActions();
  const { play } = useSounds();
  const { shortcutOverlayOpen, toggleOverlay } = useKeyboardShortcuts({
    onCancelTask: () => void stopSession(),
  });

  /* Subscribe to Tauri backend events (elf:event, session:completed) */
  useSessionEvents();

  /** Resolved session info for the embedded terminal (looked up when terminalSessionId changes). */
  interface TerminalTarget {
    readonly sessionId: string;
    readonly claudeSessionId: string;
    readonly projectPath: string;
    readonly taskLabel: string;
  }
  const [terminalTarget, setTerminalTarget] = useState<TerminalTarget | null>(null);

  /** Look up session details when terminalSessionId changes. */
  useEffect(() => {
    if (!terminalSessionId) {
      setTerminalTarget(null);
      return;
    }
    /* Look up session from Tauri backend */
    import("@/lib/tauri").then(({ listSessions }) => {
      if (!activeProjectId) return;
      listSessions(activeProjectId).then((sessions) => {
        const session = sessions.find((s) => s.id === terminalSessionId);
        if (!session?.claudeSessionId) {
          setTerminalTarget(null);
          return;
        }
        const project = projects.find((p) => p.id === session.projectId);
        setTerminalTarget({
          sessionId: session.id,
          claudeSessionId: session.claudeSessionId,
          projectPath: project?.path ?? "",
          taskLabel: session.task,
        });
      }).catch(() => setTerminalTarget(null));
    }).catch(() => setTerminalTarget(null));
  }, [terminalSessionId, activeProjectId, projects]);

  const handleCloseTerminal = useCallback((): void => {
    setTerminalSessionId(null);
  }, [setTerminalSessionId]);

  const sidebarResize = useResizable({
    initialWidth: sidebarWidth,
    onWidthChange: setSidebarWidth,
    minWidth: 200,
    maxWidth: 400,
    side: "right",
  });

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
      <div className="relative shrink-0" style={{ width: sidebarWidth }}>
        <Sidebar />
        <ResizeHandle
          side="right"
          onMouseDown={sidebarResize.handleProps.onMouseDown}
          isDragging={sidebarResize.isDragging}
        />
      </div>

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <TaskBar />

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
          terminalTarget ? (
            /* Split layout: session list (30%) + terminal (70%) */
            <div className="flex flex-1 overflow-hidden">
              <div className="flex w-[30%] min-w-[240px] shrink-0 flex-col overflow-y-auto border-r-[3px] border-border">
                <SessionHistory />
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <SessionTerminal
                  sessionId={terminalTarget.sessionId}
                  claudeSessionId={terminalTarget.claudeSessionId}
                  projectPath={terminalTarget.projectPath}
                  taskLabel={terminalTarget.taskLabel}
                  onClose={handleCloseTerminal}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <SessionHistory />
            </div>
          )
        ) : activeView === "settings" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <MemorySettings onClearAll={handleClearAll} />
          </div>
        ) : (
          <>
            {/* Plan Preview phase — shown before deployment for team tasks */}
            {isPlanPreview && pendingPlan && (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <PlanPreview plan={pendingPlan} onDeploy={handleDeploy} />
              </div>
            )}

            {/* Active session — show ElfTheater, TaskGraph, ThinkingPanel, ActivityFeed */}
            {!isPlanPreview && activeSession ? (
              <div className="flex flex-1 overflow-hidden">
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
                        className="border-b-[3px] border-border bg-success px-6 py-3 text-center"
                        data-testid="celebration-banner"
                      >
                        <p className="font-display text-xl font-bold uppercase tracking-wide text-white">
                          ALL DONE!
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <ElfTheater
                    elves={elves}
                    events={events}
                    leadElfId={leadElfId}
                    startedAt={activeSession.startedAt}
                    sessionStatus={activeSession.status}
                  />

                  {/* Task Graph — shown for team sessions */}
                  {hasTaskGraph && activeSession.plan && (
                    <div className="border-t-[3px] border-border px-4 py-4">
                      <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-gray-500">
                        Task Graph
                      </h3>
                      <TaskGraph nodes={activeSession.plan.taskGraph} />
                    </div>
                  )}

                  {/* Thinking Panel — shown for team sessions */}
                  {hasTaskGraph && (
                    <div className="border-t-[3px] border-border px-4 py-3">
                      <ThinkingPanel
                        thoughts={thinkingStream}
                        isVisible={isThinkingVisible}
                        onToggle={handleToggleThinking}
                      />
                    </div>
                  )}
                </div>

                {/* Right panel — activity feed (resizable + collapsible) */}
                {isActivityFeedVisible ? (
                  <div
                    className="relative shrink-0 border-l-[3px] border-border"
                    style={{ width: activityFeedWidth }}
                  >
                    <ResizeHandle
                      side="left"
                      onMouseDown={feedResize.handleProps.onMouseDown}
                      isDragging={feedResize.isDragging}
                    />
                    <div className="flex h-full flex-col">
                      <div className="flex items-center justify-end border-b-[3px] border-border px-3 py-1">
                        <button
                          onClick={toggleActivityFeed}
                          className="cursor-pointer border-none bg-transparent p-1 font-mono text-xs font-bold text-text-light/40 hover:text-text-light"
                          title="Collapse activity feed (Cmd+B)"
                        >
                          {"\u00BB"}
                        </button>
                      </div>
                      <ActivityFeed events={events} maxHeight="100%" />
                    </div>
                  </div>
                ) : (
                  <div className="flex w-6 shrink-0 flex-col items-center border-l-[3px] border-border bg-white pt-2">
                    <button
                      onClick={toggleActivityFeed}
                      className="cursor-pointer border-none bg-transparent p-1 font-mono text-xs font-bold text-text-light/40 hover:text-text-light"
                      title="Expand activity feed (Cmd+B)"
                    >
                      {"\u00AB"}
                    </button>
                  </div>
                )}
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
                        className="mx-auto mt-8 w-full max-w-md border-[3px] border-border bg-white p-6 shadow-brutal-lg"
                        data-testid="completion-summary"
                      >
                        <div className="mb-4 border-b-[3px] border-border pb-3 text-center">
                          <p className="font-display text-3xl font-black uppercase tracking-tight text-success">
                            ALL DONE!
                          </p>
                          <p className="mt-1 font-body text-sm text-gray-600">
                            The elves have spoken. Task completed successfully.
                          </p>
                        </div>
                        <p className="mb-3 truncate font-body text-sm font-bold" title={completedSummary.task}>
                          {completedSummary.task}
                        </p>
                        <div className="mb-4 flex gap-4">
                          <div className="border-[2px] border-border/30 px-3 py-1">
                            <p className="font-mono text-xs text-gray-500">Elapsed</p>
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
                            className="flex-1 cursor-pointer border-[3px] border-border bg-elf-gold px-4 py-2 font-display text-xs font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                            data-testid="view-in-history-btn"
                          >
                            View in History
                          </button>
                          <button
                            onClick={handleNewTask}
                            className="flex-1 cursor-pointer border-[3px] border-border bg-white px-4 py-2 font-display text-xs font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
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

        {/* Shortcut overlay — toggled via Cmd+/ */}
        <ShortcutOverlay isOpen={shortcutOverlayOpen} onClose={toggleOverlay} />
      </main>

      {/* New project creation dialog */}
      <NewProjectDialog
        isOpen={isNewProjectDialogOpen}
        onClose={() => setNewProjectDialogOpen(false)}
      />
    </div>
  );
}
