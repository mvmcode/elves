/* Team session lifecycle hook — orchestrates task analysis, plan preview, team deployment, and completion. */

import { useCallback, useRef, useEffect } from "react";
import { useSessionStore } from "@/stores/session";
import { useProjectStore } from "@/stores/project";
import { useAppStore } from "@/stores/app";
import {
  analyzeTask as invokeAnalyzeTask,
  startTask as invokeStartTask,
  startTeamTask as invokeStartTeamTask,
  stopTask as invokeStopTask,
  stopTeamTask as invokeStopTeamTask,
} from "@/lib/tauri";
import { generateElf, getStatusMessage } from "@/lib/elf-names";
import type { Runtime, ElfStatus } from "@/types/elf";
import type { TaskPlan } from "@/types/session";

/** Delay in milliseconds before elves transition from "done" to "sleeping" */
const SLEEP_DELAY_MS = 5000;

/**
 * Provides the full Phase 3 task lifecycle:
 * 1. Analyze task → determine solo vs team
 * 2. Show plan preview for team tasks (or auto-deploy for solo)
 * 3. Deploy agents with personality assignment
 * 4. Handle session completion with celebrations and sleep transitions
 */
export function useTeamSession(): {
  analyzeAndDeploy: (task: string) => Promise<void>;
  deployWithPlan: (plan: TaskPlan) => Promise<void>;
  completeSession: (leadName: string) => void;
  stopSession: () => Promise<void>;
  isSessionActive: boolean;
  isPlanPreview: boolean;
} {
  const activeSession = useSessionStore((s) => s.activeSession);
  const isPlanPreview = useSessionStore((s) => s.isPlanPreview);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const addElf = useSessionStore((s) => s.addElf);
  const addEvent = useSessionStore((s) => s.addEvent);
  const updateElfStatus = useSessionStore((s) => s.updateElfStatus);
  const updateAllElfStatus = useSessionStore((s) => s.updateAllElfStatus);
  const showPlanPreview = useSessionStore((s) => s.showPlanPreview);
  const acceptPlan = useSessionStore((s) => s.acceptPlan);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const runtimes = useAppStore((s) => s.runtimes);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Clean up sleep timer on unmount */
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }
    };
  }, []);

  /** Pick the default runtime based on detected runtimes */
  const getDefaultRuntime = useCallback((): Runtime => {
    return runtimes?.claudeCode ? "claude-code" : runtimes?.codex ? "codex" : "claude-code";
  }, [runtimes]);

  /**
   * Completes a session: transitions elves to done, shows celebration,
   * then sleeps elves after a delay.
   */
  const completeSession = useCallback(
    (leadName: string): void => {
      updateAllElfStatus("done");

      addEvent({
        id: `event-complete-${Date.now()}`,
        timestamp: Date.now(),
        elfId: "system",
        elfName: "System",
        runtime: getDefaultRuntime(),
        type: "task_update",
        payload: { status: "completed", message: `ALL DONE! ${leadName}: "The elfs have spoken."` },
        funnyStatus: `${leadName} declares victory!`,
      });

      endSession("Task completed successfully");

      sleepTimerRef.current = setTimeout(() => {
        updateAllElfStatus("sleeping");
      }, SLEEP_DELAY_MS);
    },
    [updateAllElfStatus, addEvent, endSession, getDefaultRuntime],
  );

  /**
   * Analyze the task and either auto-deploy (solo) or show plan preview (team).
   */
  const analyzeAndDeploy = useCallback(
    async (task: string): Promise<void> => {
      if (!activeProjectId) {
        console.error("No active project selected");
        return;
      }

      try {
        const plan = await invokeAnalyzeTask(task, activeProjectId);

        if (plan.complexity === "solo") {
          /* Solo task — skip plan preview, deploy immediately */
          const runtime = getDefaultRuntime();
          const sessionId = await invokeStartTask(activeProjectId, task, runtime);

          startSession({ id: sessionId, projectId: activeProjectId, task, runtime, plan });

          const personality = generateElf();
          addElf({
            id: `elf-${sessionId}`,
            sessionId,
            name: personality.name,
            role: plan.roles[0]?.name ?? "Worker",
            avatar: personality.avatar,
            color: personality.color,
            quirk: personality.quirk,
            runtime,
            status: "spawning",
            spawnedAt: Date.now(),
            finishedAt: null,
            parentElfId: null,
            toolsUsed: [],
          });

          addEvent({
            id: `event-spawn-${Date.now()}`,
            timestamp: Date.now(),
            elfId: `elf-${sessionId}`,
            elfName: personality.name,
            runtime,
            type: "spawn",
            payload: { role: plan.roles[0]?.name ?? "Worker" },
            funnyStatus: getStatusMessage(personality.name, "spawning"),
          });

          /* Transition to working after brief delay */
          setTimeout(() => {
            updateElfStatus(`elf-${sessionId}`, "working" as ElfStatus);
          }, 1500);
        } else {
          /* Team task — show plan preview for user approval */
          showPlanPreview(plan);
        }
      } catch (error) {
        console.error("Failed to analyze task:", error);
      }
    },
    [activeProjectId, getDefaultRuntime, startSession, addElf, addEvent, updateElfStatus, showPlanPreview],
  );

  /**
   * Deploy a team with the approved plan. Called after user approves plan preview.
   */
  const deployWithPlan = useCallback(
    async (plan: TaskPlan): Promise<void> => {
      if (!activeProjectId) return;

      acceptPlan();
      const runtime = getDefaultRuntime();

      try {
        const sessionId = await invokeStartTeamTask(activeProjectId, plan.taskGraph[0]?.label ?? "Team task", plan);

        startSession({
          id: sessionId,
          projectId: activeProjectId,
          task: plan.taskGraph.map((n) => n.label).join(", "),
          runtime,
          plan,
        });

        /* Assign a personality to each role and add to the store */
        const usedNames: string[] = [];
        plan.roles.forEach((role, index) => {
          const personality = generateElf(usedNames);
          usedNames.push(personality.name);
          const elfId = `elf-${sessionId}-${index}`;

          addElf({
            id: elfId,
            sessionId,
            name: personality.name,
            role: role.name,
            avatar: personality.avatar,
            color: personality.color,
            quirk: personality.quirk,
            runtime: (role.runtime as Runtime) || runtime,
            status: "spawning",
            spawnedAt: Date.now(),
            finishedAt: null,
            parentElfId: index === 0 ? null : `elf-${sessionId}-0`,
            toolsUsed: [],
          });

          addEvent({
            id: `event-spawn-${Date.now()}-${index}`,
            timestamp: Date.now(),
            elfId,
            elfName: personality.name,
            runtime: (role.runtime as Runtime) || runtime,
            type: "spawn",
            payload: { role: role.name, focus: role.focus },
            funnyStatus: getStatusMessage(personality.name, "spawning"),
          });
        });

        /* Stagger working transitions for visual effect */
        plan.roles.forEach((_role, index) => {
          setTimeout(() => {
            const elfId = `elf-${sessionId}-${index}`;
            updateElfStatus(elfId, "working");
          }, 1500 + index * 500);
        });
      } catch (error) {
        console.error("Failed to deploy team:", error);
      }
    },
    [activeProjectId, getDefaultRuntime, acceptPlan, startSession, addElf, addEvent, updateElfStatus],
  );

  const stopSession = useCallback(async (): Promise<void> => {
    if (!activeSession) return;

    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    try {
      const isTeam = activeSession.plan?.complexity === "team";
      if (isTeam) {
        await invokeStopTeamTask(activeSession.id);
      } else {
        await invokeStopTask(activeSession.id);
      }
      endSession("Cancelled by user");
    } catch (error) {
      console.error("Failed to stop task:", error);
    }
  }, [activeSession, endSession]);

  return {
    analyzeAndDeploy,
    deployWithPlan,
    completeSession,
    stopSession,
    isSessionActive: activeSession !== null,
    isPlanPreview,
  };
}
