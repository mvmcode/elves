/* Team session lifecycle hook — orchestrates task analysis, plan preview, and team deployment.
 * Floor-aware: operates on the active floor. If the active floor has a running session,
 * creates a new floor for the new task. */

import { useCallback } from "react";
import { useSessionStore } from "@/stores/session";
import { useProjectStore } from "@/stores/project";
import { useAppStore } from "@/stores/app";
import {
  analyzeTask as invokeAnalyzeTask,
  startTask as invokeStartTask,
  startTeamTask as invokeStartTeamTask,
  stopTask as invokeStopTask,
  stopTeamTask as invokeStopTeamTask,
  continueTask as invokeContinueTask,
  buildProjectContext,
} from "@/lib/tauri";
import { generateElf, getStatusMessage } from "@/lib/elf-names";
import type { Runtime, ElfStatus } from "@/types/elf";
import type { TaskPlan } from "@/types/session";
import type { ClaudeSpawnOptions } from "@/types/claude";

/**
 * Provides the task lifecycle for analysis and deployment:
 * 1. Analyze task -> determine solo vs team
 * 2. Show plan preview for team tasks (or auto-deploy for solo)
 * 3. Deploy agents with personality assignment
 * 4. Stop a running session
 *
 * All operations target the active floor. If the active floor already has a
 * running session, a new floor is created automatically.
 *
 * Session completion (celebrations, memory extraction, sleep transitions) is
 * handled by `useSessionEvents` which listens for `session:completed` events.
 */
export function useTeamSession(): {
  analyzeAndDeploy: (task: string) => Promise<void>;
  deployWithPlan: (plan: TaskPlan) => Promise<void>;
  continueSession: (message: string) => Promise<void>;
  stopSession: () => Promise<void>;
  isSessionActive: boolean;
  isSessionCompleted: boolean;
  isPlanPreview: boolean;
} {
  const activeSession = useSessionStore((s) => s.activeSession);
  const isPlanPreview = useSessionStore((s) => s.isPlanPreview);
  const startSession = useSessionStore((s) => s.startSession);
  const addElf = useSessionStore((s) => s.addElf);
  const addEvent = useSessionStore((s) => s.addEvent);
  const updateElfStatus = useSessionStore((s) => s.updateElfStatus);
  const showPlanPreview = useSessionStore((s) => s.showPlanPreview);
  const acceptPlan = useSessionStore((s) => s.acceptPlan);
  const createFloor = useSessionStore((s) => s.createFloor);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);

  /** Build ClaudeSpawnOptions from current app store selections. */
  const buildSpawnOptions = useCallback((): ClaudeSpawnOptions => {
    const { selectedAgent, selectedModel, selectedApprovalMode, budgetCap } =
      useAppStore.getState();
    return {
      agent: selectedAgent?.slug ?? undefined,
      model: selectedModel ?? selectedAgent?.model ?? undefined,
      permissionMode: selectedApprovalMode ?? undefined,
      maxBudgetUsd: budgetCap ?? undefined,
    };
  }, []);

  /**
   * Ensure the active floor is available for a new task.
   * If it already has a running session, create a new floor first.
   */
  const ensureAvailableFloor = useCallback((): void => {
    const state = useSessionStore.getState();
    const floorId = state.activeFloorId;
    if (!floorId) return;
    const floor = state.floors[floorId];
    if (floor?.session?.status === "active") {
      createFloor();
    }
  }, [createFloor]);

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
        /* Ensure we have an available floor */
        ensureAvailableFloor();

        /* Pre-task: build context from project memories (boosts relevance for used memories) */
        buildProjectContext(activeProjectId).catch((error: unknown) => {
          console.error("Failed to build project context:", error);
        });

        const plan = await invokeAnalyzeTask(task, activeProjectId);

        /* When forceTeamMode is active, override solo classification to show plan preview
         * so the user can configure roles before deployment. */
        const { forceTeamMode } = useAppStore.getState();
        if (forceTeamMode && plan.complexity === "solo") {
          showPlanPreview(plan);
          return;
        }

        if (plan.complexity === "solo") {
          /* Solo task — skip plan preview, deploy immediately */
          const runtime = defaultRuntime;
          const spawnOptions = buildSpawnOptions();
          const sessionId = await invokeStartTask(activeProjectId, task, runtime, spawnOptions);

          startSession({
            id: sessionId,
            projectId: activeProjectId,
            task,
            runtime,
            plan,
            appliedOptions: {
              agent: spawnOptions.agent,
              model: spawnOptions.model,
              permissionMode: spawnOptions.permissionMode,
            },
          });

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
    [activeProjectId, defaultRuntime, buildSpawnOptions, ensureAvailableFloor, startSession, addElf, addEvent, updateElfStatus, showPlanPreview],
  );

  /**
   * Deploy a team with the approved plan. Called after user approves plan preview.
   */
  const deployWithPlan = useCallback(
    async (plan: TaskPlan): Promise<void> => {
      if (!activeProjectId) return;

      acceptPlan();
      const runtime = defaultRuntime;

      try {
        const spawnOptions = buildSpawnOptions();
        const sessionId = await invokeStartTeamTask(activeProjectId, plan.taskGraph[0]?.label ?? "Team task", plan, spawnOptions);

        startSession({
          id: sessionId,
          projectId: activeProjectId,
          task: plan.taskGraph.map((n) => n.label).join(", "),
          runtime,
          plan,
          appliedOptions: {
            agent: spawnOptions.agent,
            model: spawnOptions.model,
            permissionMode: spawnOptions.permissionMode,
          },
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
    [activeProjectId, defaultRuntime, buildSpawnOptions, acceptPlan, startSession, addElf, addEvent, updateElfStatus],
  );

  /**
   * Continue a completed session with a follow-up message.
   * Spawns a new `--print --resume` process and reactivates the session.
   */
  const continueSession = useCallback(
    async (message: string): Promise<void> => {
      if (!activeSession || activeSession.status !== "completed") return;
      if (!activeSession.claudeSessionId) {
        console.error("Cannot continue — no Claude session ID");
        return;
      }

      try {
        const spawnOptions = buildSpawnOptions();

        /* Add user message event to the activity feed */
        addEvent({
          id: `event-followup-${Date.now()}`,
          timestamp: Date.now(),
          elfId: "user",
          elfName: "You",
          runtime: activeSession.runtime,
          type: "chat",
          payload: { text: message },
        });

        await invokeContinueTask(activeSession.id, message, spawnOptions);
        /* The session:continued event handler in useSessionEvents will reactivate the session */
      } catch (error) {
        console.error("Failed to continue session:", error);
      }
    },
    [activeSession, buildSpawnOptions, addEvent],
  );

  const updateAllElfStatusOnFloor = useSessionStore((s) => s.updateAllElfStatusOnFloor);
  const endSessionOnFloor = useSessionStore((s) => s.endSessionOnFloor);

  const stopSession = useCallback(async (): Promise<void> => {
    if (!activeSession) return;

    // Optimistic UI update — respond instantly while the backend catches up.
    // endSessionOnFloor and updateAllElfStatusOnFloor are idempotent, so the
    // session:cancelled event handler re-applying them is a harmless no-op.
    const floorId = useSessionStore.getState().activeFloorId;
    if (floorId) {
      updateAllElfStatusOnFloor(floorId, "done");
      endSessionOnFloor(floorId, "cancelled");
    }

    try {
      const isTeam = activeSession.plan?.complexity === "team";
      if (isTeam) {
        await invokeStopTeamTask(activeSession.id);
      } else {
        await invokeStopTask(activeSession.id);
      }
    } catch (error) {
      console.error("Failed to stop task:", error);
    }
  }, [activeSession, updateAllElfStatusOnFloor, endSessionOnFloor]);

  return {
    analyzeAndDeploy,
    deployWithPlan,
    continueSession,
    stopSession,
    isSessionActive: activeSession !== null && activeSession.status === "active",
    isSessionCompleted: activeSession !== null && activeSession.status === "completed",
    isPlanPreview,
  };
}
