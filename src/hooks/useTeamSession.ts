/* Team session lifecycle hook — orchestrates task analysis, plan preview, and team deployment.
 * Floor-aware: operates on the active floor. If the active floor has a running session,
 * creates a new floor for the new task. */

import { useCallback } from "react";
import { useSessionStore } from "@/stores/session";
import { useProjectStore } from "@/stores/project";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import {
  analyzeTask as invokeAnalyzeTask,
  startTaskPty as invokeStartTaskPty,
  startTeamTask as invokeStartTeamTask,
  stopTask as invokeStopTask,
  stopTeamTask as invokeStopTeamTask,
  buildProjectContext,
  createWorkspace,
} from "@/lib/tauri";
import { generateElf, getStatusMessage } from "@/lib/elf-names";
import { generateWorkspaceSlug } from "@/lib/slug";
import type { Runtime, ElfStatus } from "@/types/elf";
import type { TaskPlan } from "@/types/session";
import type { ClaudeSpawnOptions } from "@/types/claude";
import { buildAugmentedPrompt } from "@/components/layout/FileAttachment";

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
  stopSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
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
  const activeProjectPath = useProjectStore((s) => {
    if (!s.activeProjectId) return null;
    return s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null;
  });
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const setFloorWorktree = useSessionStore((s) => s.setFloorWorktree);
  const setFloorPtyId = useSessionStore((s) => s.setFloorPtyId);
  const renameFloor = useSessionStore((s) => s.renameFloor);

  /** Build ClaudeSpawnOptions from current app store selections, falling through to settings defaults. */
  const buildSpawnOptions = useCallback((): ClaudeSpawnOptions => {
    const { selectedAgent, selectedModel, selectedApprovalMode, budgetCap, selectedEffort } =
      useAppStore.getState();
    const settings = useSettingsStore.getState();
    return {
      agent: selectedAgent?.slug ?? undefined,
      model: selectedModel ?? selectedAgent?.model ?? settings.defaultModel ?? undefined,
      permissionMode: selectedApprovalMode ?? settings.defaultPermissionMode ?? undefined,
      maxBudgetUsd: budgetCap ?? settings.defaultBudgetCap ?? undefined,
      effort: selectedEffort ?? settings.defaultEffort ?? undefined,
      appendSystemPrompt: settings.customSystemPrompt || undefined,
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

        /* Augment the task text with any attached file contents, then clear attachments */
        const { attachedFiles, clearAttachedFiles } = useAppStore.getState();
        const augmentedTask = buildAugmentedPrompt(task, attachedFiles);
        clearAttachedFiles();

        /* Pre-task: build context from project memories (boosts relevance for used memories) */
        buildProjectContext(activeProjectId).catch((error: unknown) => {
          console.error("Failed to build project context:", error);
        });

        /* Auto-create a worktree for task isolation (silently falls back to project root) */
        let worktreeWorkingDir: string | undefined;
        const activeFloorIdNow = useSessionStore.getState().activeFloorId;
        if (activeProjectPath && activeFloorIdNow) {
          try {
            const slug = generateWorkspaceSlug(augmentedTask);
            const workspaceInfo = await createWorkspace(activeProjectPath, slug);
            worktreeWorkingDir = workspaceInfo.path;
            setFloorWorktree(activeFloorIdNow, slug, workspaceInfo.path);
          } catch (worktreeError) {
            console.warn("Auto-worktree creation failed, using project root:", worktreeError);
          }
          /* Rename the floor tab to reflect the task */
          renameFloor(activeFloorIdNow, augmentedTask.slice(0, 30) || "Task");
        }

        const plan = await invokeAnalyzeTask(augmentedTask, activeProjectId);

        /* When forceTeamMode is active, override solo classification to show plan preview
         * so the user can configure roles before deployment. */
        const { forceTeamMode } = useAppStore.getState();
        if (forceTeamMode && plan.complexity === "solo") {
          showPlanPreview(plan);
          return;
        }

        if (plan.complexity === "solo") {
          /* Solo task — skip plan preview, deploy immediately via PTY-first */
          const runtime = defaultRuntime;
          const spawnOptions = buildSpawnOptions();
          const { sessionId, ptyId } = await invokeStartTaskPty(
            activeProjectId, augmentedTask, runtime, worktreeWorkingDir, spawnOptions,
          );

          /* Store ptyId on the floor so SessionSplitView can wire xterm to it */
          const currentFloorId = useSessionStore.getState().activeFloorId;
          if (currentFloorId) {
            setFloorPtyId(currentFloorId, ptyId);
          }

          startSession({
            id: sessionId,
            projectId: activeProjectId,
            task: augmentedTask,
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
    [activeProjectId, activeProjectPath, defaultRuntime, buildSpawnOptions, ensureAvailableFloor, startSession, addElf, addEvent, updateElfStatus, showPlanPreview, setFloorWorktree, setFloorPtyId, renameFloor],
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
        /* Use worktree path from the active floor if one was created during analyzeAndDeploy */
        const activeFloor = useSessionStore.getState().floors[useSessionStore.getState().activeFloorId ?? ""];
        const worktreeWorkingDir = activeFloor?.worktreePath ?? undefined;

        const spawnOptions = buildSpawnOptions();
        const sessionId = await invokeStartTeamTask(activeProjectId, plan.taskGraph[0]?.label ?? "Team task", plan, spawnOptions, worktreeWorkingDir);

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

        /* Create only the lead elf — additional elves appear when Claude spawns sub-agents.
         * This prevents phantom elves: 1 running Claude process = 1 elf. */
        const leadRole = plan.roles[0];
        if (leadRole) {
          const personality = generateElf();
          const elfId = `elf-${sessionId}`;

          addElf({
            id: elfId,
            sessionId,
            name: personality.name,
            role: leadRole.name,
            avatar: personality.avatar,
            color: personality.color,
            quirk: personality.quirk,
            runtime: (leadRole.runtime as Runtime) || runtime,
            status: "spawning",
            spawnedAt: Date.now(),
            finishedAt: null,
            parentElfId: null,
            toolsUsed: [],
          });

          addEvent({
            id: `event-spawn-${Date.now()}`,
            timestamp: Date.now(),
            elfId,
            elfName: personality.name,
            runtime: (leadRole.runtime as Runtime) || runtime,
            type: "spawn",
            payload: { role: leadRole.name, focus: leadRole.focus },
            funnyStatus: getStatusMessage(personality.name, "spawning"),
          });

          /* Transition to working after brief spawn animation */
          setTimeout(() => updateElfStatus(elfId, "working"), 1500);
        }
      } catch (error) {
        console.error("Failed to deploy team:", error);
      }
    },
    [activeProjectId, defaultRuntime, buildSpawnOptions, acceptPlan, startSession, addElf, addEvent, updateElfStatus],
  );

  const updateAllElfStatusOnFloor = useSessionStore((s) => s.updateAllElfStatusOnFloor);
  const endSessionOnFloor = useSessionStore((s) => s.endSessionOnFloor);

  /**
   * Resume a completed/cancelled session using Claude's --resume flag.
   * Reads the claudeSessionId from the active floor's session and spawns
   * a new PTY with --resume <claudeSessionId>. Reuses existing elves.
   */
  const resumeSession = useCallback(async (): Promise<void> => {
    if (!activeProjectId) return;

    const state = useSessionStore.getState();
    const floorId = state.activeFloorId;
    if (!floorId) return;

    const floor = state.floors[floorId];
    const claudeSessionId = floor?.session?.claudeSessionId;
    if (!claudeSessionId) {
      console.warn("Cannot resume: no claudeSessionId on active floor");
      return;
    }

    try {
      const runtime = defaultRuntime;
      const worktreeWorkingDir = floor.worktreePath ?? undefined;
      const spawnOptions = buildSpawnOptions();

      const { ptyId } = await invokeStartTaskPty(
        activeProjectId,
        "Resuming session...",
        runtime,
        worktreeWorkingDir,
        { ...spawnOptions, resumeSessionId: claudeSessionId },
      );

      /* Store new ptyId on the floor and transition session back to active */
      setFloorPtyId(floorId, ptyId);
      endSessionOnFloor(floorId, "active");

      /* Re-activate elves */
      updateAllElfStatusOnFloor(floorId, "working");
    } catch (error) {
      console.error("Failed to resume session:", error);
    }
  }, [activeProjectId, defaultRuntime, buildSpawnOptions, setFloorPtyId, endSessionOnFloor, updateAllElfStatusOnFloor]);

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
    stopSession,
    resumeSession,
    isSessionActive: activeSession !== null && activeSession.status === "active",
    isSessionCompleted: activeSession !== null && activeSession.status === "completed",
    isPlanPreview,
  };
}
