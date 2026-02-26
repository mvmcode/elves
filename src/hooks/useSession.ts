/* Session lifecycle hook — starts tasks, listens for Tauri events, and updates the session store. */

import { useCallback } from "react";
import { useSessionStore } from "@/stores/session";
import { useProjectStore } from "@/stores/project";
import { useAppStore } from "@/stores/app";
import { startTask as invokeStartTask, stopTask as invokeStopTask } from "@/lib/tauri";
import { generateMinion, getStatusMessage } from "@/lib/minion-names";
import type { Runtime, MinionStatus } from "@/types/minion";

/**
 * Provides task lifecycle actions: deploy a new task and stop a running task.
 * Manages the bridge between Tauri IPC commands and the frontend session store.
 */
export function useSession(): {
  deployTask: (task: string) => Promise<void>;
  stopSession: () => Promise<void>;
  isSessionActive: boolean;
} {
  const activeSession = useSessionStore((s) => s.activeSession);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const addMinion = useSessionStore((s) => s.addMinion);
  const addEvent = useSessionStore((s) => s.addEvent);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const runtimes = useAppStore((s) => s.runtimes);

  const deployTask = useCallback(
    async (task: string): Promise<void> => {
      if (!activeProjectId) {
        console.error("No active project selected");
        return;
      }

      /* Pick the default runtime based on what's available */
      const runtime: Runtime = runtimes?.claudeCode
        ? "claude-code"
        : runtimes?.codex
          ? "codex"
          : "claude-code";

      try {
        /* Call the Rust backend to create session + spawn agent process */
        const sessionId = await invokeStartTask(activeProjectId, task, runtime);

        /* Update frontend session store */
        startSession({
          id: sessionId,
          projectId: activeProjectId,
          task,
          runtime,
        });

        /* Generate a personality for the minion and add to store */
        const personality = generateMinion();
        addMinion({
          id: `minion-${sessionId}`,
          sessionId,
          name: personality.name,
          role: null,
          avatar: personality.avatar,
          color: personality.color,
          quirk: personality.quirk,
          runtime,
          status: "spawning",
          spawnedAt: Date.now(),
          finishedAt: null,
          parentMinionId: null,
          toolsUsed: [],
        });

        /* Add a spawn event to the feed */
        addEvent({
          id: `event-spawn-${Date.now()}`,
          timestamp: Date.now(),
          minionId: `minion-${sessionId}`,
          minionName: personality.name,
          runtime,
          type: "spawn",
          payload: { role: null },
          funnyStatus: getStatusMessage(personality.name, "spawning"),
        });

        /* Simulate the minion transitioning to "working" after a brief delay */
        setTimeout(() => {
          useSessionStore.getState().updateMinionStatus(`minion-${sessionId}`, "working" as MinionStatus);
          const workingStatus = getStatusMessage(personality.name, "working");
          useSessionStore.getState().addEvent({
            id: `event-working-${Date.now()}`,
            timestamp: Date.now(),
            minionId: `minion-${sessionId}`,
            minionName: personality.name,
            runtime,
            type: "thinking",
            payload: { text: workingStatus },
            funnyStatus: workingStatus,
          });
        }, 1500);
      } catch (error) {
        console.error("Failed to start task:", error);
      }
    },
    [activeProjectId, runtimes, startSession, addMinion, addEvent],
  );

  const stopSession = useCallback(async (): Promise<void> => {
    if (!activeSession) return;

    try {
      await invokeStopTask(activeSession.id);
      endSession("Cancelled by user");
    } catch (error) {
      console.error("Failed to stop task:", error);
    }
  }, [activeSession, endSession]);

  return {
    deployTask,
    stopSession,
    isSessionActive: activeSession !== null,
  };
}
