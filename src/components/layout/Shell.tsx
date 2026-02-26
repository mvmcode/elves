/* App shell — top-level layout composing sidebar, top bar, task bar, and content area. */

import { useState, useCallback } from "react";
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
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useTeamSession } from "@/hooks/useTeamSession";
import { useMemoryActions } from "@/hooks/useMemoryActions";

/**
 * Root layout shell matching the UI design from product plan Section 7.1.
 * Left sidebar + main area (top bar, task bar, center content, activity feed).
 * Routes between session workshop, memory explorer, and settings views.
 * Shows PlanPreview during plan phase, ElfTheater + TaskGraph + ThinkingPanel during
 * active sessions, celebration banner on completion, or empty state when idle.
 */
export function Shell(): React.JSX.Element {
  const activeView = useUiStore((state) => state.activeView);
  const activeSession = useSessionStore((state) => state.activeSession);
  const elves = useSessionStore((state) => state.elves);
  const events = useSessionStore((state) => state.events);
  const thinkingStream = useSessionStore((state) => state.thinkingStream);
  const isPlanPreview = useSessionStore((state) => state.isPlanPreview);
  const pendingPlan = useSessionStore((state) => state.pendingPlan);
  const { deployWithPlan } = useTeamSession();
  const {
    handleCreateMemory,
    handleEditMemory,
    handlePinMemory,
    handleDeleteMemory,
    handleSearch,
    handleClearAll,
  } = useMemoryActions();

  const [isThinkingVisible, setIsThinkingVisible] = useState(false);

  const handleToggleThinking = useCallback((): void => {
    setIsThinkingVisible((prev) => !prev);
  }, []);

  const handleDeploy = useCallback(
    (plan: Parameters<typeof deployWithPlan>[0]): void => {
      void deployWithPlan(plan);
    },
    [deployWithPlan],
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
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <TaskBar />

        {/* View routing — session workshop, memory explorer, or settings */}
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
                        className="border-b-[3px] border-border bg-success px-6 py-4 text-center"
                        data-testid="celebration-banner"
                      >
                        <p className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                          ALL DONE!
                        </p>
                        <p className="mt-1 font-body text-sm font-bold text-white/80">
                          The elves have spoken. Task completed successfully.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <ElfTheater
                    elves={elves}
                    events={events}
                    leadElfId={leadElfId}
                    startedAt={activeSession.startedAt}
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

                {/* Right panel — activity feed */}
                <div className="w-96 shrink-0 border-l-[3px] border-border">
                  <ActivityFeed events={events} maxHeight="100%" />
                </div>
              </div>
            ) : (
              /* Empty state — no session and not in plan preview */
              !isPlanPreview && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <EmptyState
                    message="Your elves are bored. Give them something to do."
                    submessage="Type a task above and summon the elves to get started."
                  />
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}
