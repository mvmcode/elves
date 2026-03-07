/* Team session lifecycle hook — orchestrates task analysis, plan preview, and team deployment.
 * Floor-aware: operates on the active floor. If the active floor has a running session,
 * creates a new floor for the new task. */

import { useCallback } from "react";
import { useSessionStore } from "@/stores/session";
import { useProjectStore } from "@/stores/project";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useWorkspaceStore } from "@/stores/workspace";
import {
  analyzeTask as invokeAnalyzeTask,
  startTaskPty as invokeStartTaskPty,
  startTeamTaskPty as invokeStartTeamTaskPty,
  stopTask as invokeStopTask,
  stopTeamTask as invokeStopTeamTask,
  buildProjectContext,
  createWorkspace,
  listWorkspaces,
  createMultiRepoWorkspace,
  listMultiRepoWorkspaces,
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

        /* Create workspace — worktree mode isolates via git worktree, direct mode skips git entirely. */
        let worktreeWorkingDir: string | undefined;
        let worktreeCreated = false;
        const activeFloorIdNow = useSessionStore.getState().activeFloorId;
        if (activeProjectPath && activeFloorIdNow) {
          const { sessionMode, topology } = useWorkspaceStore.getState();
          const slug = generateWorkspaceSlug(augmentedTask);

          if (sessionMode === "direct") {
            /* Direct mode — skip worktree creation, run agent in the project folder. */
            worktreeWorkingDir = activeProjectPath;
            setFloorWorktree(activeFloorIdNow, slug, activeProjectPath);
          } else {
            try {
              if (topology?.kind === "multi_repo") {
                const repoPaths = topology.repos.map((r) => r.path);
                const mrWorkspace = await createMultiRepoWorkspace(activeProjectPath, slug, repoPaths);
                worktreeWorkingDir = activeProjectPath;
                setFloorWorktree(activeFloorIdNow, slug, activeProjectPath);
                worktreeCreated = true;
                const firstEntry = mrWorkspace.repos[0];
                if (firstEntry) {
                  useWorkspaceStore.getState().addWorkspace(firstEntry.workspace);
                }
              } else {
                const workspaceInfo = await createWorkspace(activeProjectPath, slug);
                worktreeWorkingDir = workspaceInfo.path;
                setFloorWorktree(activeFloorIdNow, slug, workspaceInfo.path);
                worktreeCreated = true;
              }
            } catch (worktreeError) {
              console.warn("Auto-worktree creation failed, falling back to project root:", worktreeError);
              worktreeWorkingDir = activeProjectPath;
              setFloorWorktree(activeFloorIdNow, slug, activeProjectPath);
            }
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
          const wsSlugForBackend = useSessionStore.getState().floors[
            useSessionStore.getState().activeFloorId ?? ""
          ]?.worktreeSlug ?? undefined;
          const { sessionId, ptyId } = await invokeStartTaskPty(
            activeProjectId, augmentedTask, runtime, worktreeWorkingDir, spawnOptions, wsSlugForBackend,
          );

          /* Store ptyId on the floor for session tracking */
          const currentFloorId = useSessionStore.getState().activeFloorId;
          if (currentFloorId) {
            setFloorPtyId(currentFloorId, ptyId);
          }

          /* Wire PTY to workspace store and navigate to terminal view */
          const wsSlug = useSessionStore.getState().floors[currentFloorId ?? ""]?.worktreeSlug;
          if (wsSlug) {
            const wsStore = useWorkspaceStore.getState();
            /* Add workspace eagerly so the terminal view can find it immediately.
             * Use branch="" when no real worktree was created (direct mode or fallback). */
            wsStore.addWorkspace({
              slug: wsSlug,
              path: worktreeWorkingDir ?? "",
              branch: worktreeCreated ? `worktree-${wsSlug}` : "",
              status: "active",
              filesChanged: 0,
              lastModified: new Date().toISOString(),
            });
            wsStore.setPtyId(wsSlug, ptyId);
            wsStore.openWorkspace(wsSlug);
            /* Background refresh for full metadata — only when a real worktree was created.
             * Skipped for direct mode and worktree-fallback to avoid overwriting the eager entry. */
            if (activeProjectPath && worktreeCreated) {
              const { topology: currentTopology } = useWorkspaceStore.getState();
              if (currentTopology?.kind === "multi_repo") {
                const repoPaths = currentTopology.repos.map((r) => r.path);
                listMultiRepoWorkspaces(activeProjectPath, repoPaths)
                  .then((ws) => wsStore.setMultiRepoWorkspaces(ws))
                  .catch(() => { /* workspace list refresh is best-effort */ });
              } else {
                listWorkspaces(activeProjectPath)
                  .then((ws) => wsStore.setWorkspaces(ws))
                  .catch(() => { /* workspace list refresh is best-effort */ });
              }
            }
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
        console.error("Failed to analyze/deploy task:", error);
        useWorkspaceStore.getState().setError(
          `Deploy failed: ${error instanceof Error ? error.message : String(error)}`,
        );
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
        const taskLabel = plan.taskGraph[0]?.label ?? "Team task";

        const spawnOptions = buildSpawnOptions();
        const teamWsSlugForBackend = activeFloor?.worktreeSlug ?? undefined;
        const { sessionId, ptyEntries } = await invokeStartTeamTaskPty(
          activeProjectId, taskLabel, plan, worktreeWorkingDir, spawnOptions, teamWsSlugForBackend,
        );

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

        /* Wire PTY entries to workspace store → triggers split terminal view */
        const teamWsSlug = activeFloor?.worktreeSlug;
        if (teamWsSlug) {
          const wsStore = useWorkspaceStore.getState();
          /* Check if a real worktree was created (worktreePath !== activeProjectPath for single-repo). */
          const hasRealWorktree = worktreeWorkingDir !== undefined && worktreeWorkingDir !== activeProjectPath;
          wsStore.addWorkspace({
            slug: teamWsSlug,
            path: worktreeWorkingDir ?? "",
            branch: hasRealWorktree ? `worktree-${teamWsSlug}` : "",
            status: "active",
            filesChanged: 0,
            lastModified: new Date().toISOString(),
          });
          wsStore.setTeamPtyEntries(teamWsSlug, ptyEntries.map((e) => ({
            role: e.role,
            ptyId: e.ptyId,
            elfId: e.elfId,
          })));
          if (ptyEntries[0]) {
            wsStore.setPtyId(teamWsSlug, ptyEntries[0].ptyId);
          }
          wsStore.openWorkspace(teamWsSlug);
          /* Background refresh — only when a real worktree exists. */
          if (activeProjectPath && hasRealWorktree) {
            const { topology: currentTopology } = useWorkspaceStore.getState();
            if (currentTopology?.kind === "multi_repo") {
              const repoPaths = currentTopology.repos.map((r) => r.path);
              listMultiRepoWorkspaces(activeProjectPath, repoPaths)
                .then((ws) => wsStore.setMultiRepoWorkspaces(ws))
                .catch(() => { /* best-effort refresh */ });
            } else {
              listWorkspaces(activeProjectPath)
                .then((ws) => wsStore.setWorkspaces(ws))
                .catch(() => { /* best-effort refresh */ });
            }
          }
        }

        /* Store first ptyId on the floor for session tracking */
        const currentFloorId = useSessionStore.getState().activeFloorId;
        if (currentFloorId && ptyEntries[0]) {
          setFloorPtyId(currentFloorId, ptyEntries[0].ptyId);
        }

        /* Create one elf per role with personality */
        for (let i = 0; i < plan.roles.length; i++) {
          const role = plan.roles[i]!;
          const entry = ptyEntries[i];
          const personality = generateElf();
          const elfId = entry?.elfId ?? `elf-${sessionId}-${i}`;

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
            parentElfId: null,
            toolsUsed: [],
          });

          addEvent({
            id: `event-spawn-${Date.now()}-${i}`,
            timestamp: Date.now(),
            elfId,
            elfName: personality.name,
            runtime: (role.runtime as Runtime) || runtime,
            type: "spawn",
            payload: { role: role.name, focus: role.focus },
            funnyStatus: getStatusMessage(personality.name, "spawning"),
          });

          /* Stagger spawn animations */
          const capturedElfId = elfId;
          setTimeout(() => updateElfStatus(capturedElfId, "working"), 1500 + i * 300);
        }
      } catch (error) {
        console.error("Failed to deploy team:", error);
      }
    },
    [activeProjectId, activeProjectPath, defaultRuntime, buildSpawnOptions, acceptPlan, startSession, addElf, addEvent, updateElfStatus, setFloorPtyId],
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
      const runtime = floor.session?.runtime ?? defaultRuntime;
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
