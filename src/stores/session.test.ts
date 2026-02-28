/* Tests for the session store — verifies all state transitions, floor CRUD, event routing, and snapshot sync. */

import { describe, expect, it, beforeEach } from "vitest";
import { useSessionStore } from "./session";
import type { Elf, ElfEvent } from "@/types/elf";
import type { TaskPlan } from "@/types/session";
import type { ActiveSession } from "./session";

/** Reset store state between tests — close ALL floors so a fresh default is created. */
function resetStore(): void {
  const floors = useSessionStore.getState().getOrderedFloors();
  for (const floor of floors) {
    useSessionStore.getState().closeFloor(floor.id);
  }
}

/** Factory for a minimal valid Elf */
function createTestElf(overrides: Partial<Elf> = {}): Elf {
  return {
    id: "elf-1",
    sessionId: "session-1",
    name: "Spark",
    role: "engineer",
    avatar: "\u26A1",
    color: "#FF6B6B",
    quirk: "Leaves glitter on every file they touch",
    runtime: "claude-code",
    status: "spawning",
    spawnedAt: Date.now(),
    finishedAt: null,
    parentElfId: null,
    toolsUsed: [],
    ...overrides,
  };
}

/** Factory for a minimal valid ElfEvent */
function createTestEvent(overrides: Partial<ElfEvent> = {}): ElfEvent {
  return {
    id: "event-1",
    timestamp: Date.now(),
    elfId: "elf-1",
    elfName: "Spark",
    runtime: "claude-code",
    type: "output",
    payload: { text: "Hello world" },
    ...overrides,
  };
}

/** Factory for a minimal valid TaskPlan */
function createTestPlan(overrides: Partial<TaskPlan> = {}): TaskPlan {
  return {
    complexity: "team",
    agentCount: 2,
    roles: [
      { name: "Researcher", focus: "Research competitors", runtime: "claude-code" },
      { name: "Writer", focus: "Write the report", runtime: "claude-code" },
    ],
    taskGraph: [
      { id: "t1", label: "Research", assignee: "Researcher", dependsOn: [], status: "pending" },
      { id: "t2", label: "Report", assignee: "Writer", dependsOn: ["t1"], status: "pending" },
    ],
    runtimeRecommendation: "claude-code",
    estimatedDuration: "~4 minutes",
    ...overrides,
  };
}

describe("useSessionStore", () => {
  beforeEach(() => {
    resetStore();
  });

  /* ── Floor management ─────────────────────────────────────── */

  describe("floor management", () => {
    it("starts with one default floor", () => {
      const floors = useSessionStore.getState().getOrderedFloors();
      expect(floors).toHaveLength(1);
      expect(floors[0]!.label).toBe("New Floor");
      expect(useSessionStore.getState().activeFloorId).toBe(floors[0]!.id);
    });

    it("createFloor adds a new floor and switches to it", () => {
      const originalFloorId = useSessionStore.getState().activeFloorId;
      const newFloorId = useSessionStore.getState().createFloor("Test Floor");

      expect(newFloorId).not.toBe(originalFloorId);
      expect(useSessionStore.getState().activeFloorId).toBe(newFloorId);
      expect(useSessionStore.getState().getOrderedFloors()).toHaveLength(2);
    });

    it("createFloor assigns correct label", () => {
      const floorId = useSessionStore.getState().createFloor("My Floor");
      const floor = useSessionStore.getState().floors[floorId];
      expect(floor!.label).toBe("My Floor");
    });

    it("createFloor uses default label when none provided", () => {
      const floorId = useSessionStore.getState().createFloor();
      const floor = useSessionStore.getState().floors[floorId];
      expect(floor!.label).toBe("New Floor");
    });

    it("switchFloor changes the active floor and syncs snapshot", () => {
      const firstFloorId = useSessionStore.getState().activeFloorId!;

      /* Start a session on first floor */
      useSessionStore.getState().startSession({
        id: "session-1", projectId: "p1", task: "Task 1", runtime: "claude-code",
      });
      useSessionStore.getState().addEvent(createTestEvent({ id: "e1" }));

      /* Create and switch to second floor */
      useSessionStore.getState().createFloor("Floor 2");
      expect(useSessionStore.getState().events).toEqual([]);
      expect(useSessionStore.getState().activeSession).toBeNull();

      /* Switch back to first floor */
      useSessionStore.getState().switchFloor(firstFloorId);
      expect(useSessionStore.getState().activeSession!.id).toBe("session-1");
      expect(useSessionStore.getState().events).toHaveLength(1);
    });

    it("closeFloor removes the floor", () => {
      const secondFloorId = useSessionStore.getState().createFloor("Floor 2");
      expect(useSessionStore.getState().getOrderedFloors()).toHaveLength(2);

      useSessionStore.getState().closeFloor(secondFloorId);
      expect(useSessionStore.getState().getOrderedFloors()).toHaveLength(1);
    });

    it("closeFloor switches to adjacent when closing active", () => {
      const firstFloorId = useSessionStore.getState().activeFloorId!;
      const closingFloorId = useSessionStore.getState().createFloor("Floor 2");
      expect(useSessionStore.getState().activeFloorId).toBe(closingFloorId);

      useSessionStore.getState().closeFloor(closingFloorId);
      expect(useSessionStore.getState().activeFloorId).toBe(firstFloorId);
    });

    it("closeFloor creates a new default floor when last floor is closed", () => {
      const onlyFloorId = useSessionStore.getState().activeFloorId!;
      useSessionStore.getState().closeFloor(onlyFloorId);

      const floors = useSessionStore.getState().getOrderedFloors();
      expect(floors).toHaveLength(1);
      expect(floors[0]!.id).not.toBe(onlyFloorId);
    });

    it("closeFloor does nothing for non-existent floor", () => {
      const before = useSessionStore.getState().getOrderedFloors().length;
      useSessionStore.getState().closeFloor("nonexistent");
      expect(useSessionStore.getState().getOrderedFloors()).toHaveLength(before);
    });

    it("getOrderedFloors returns floors sorted by order", () => {
      useSessionStore.getState().createFloor("Floor 2");
      useSessionStore.getState().createFloor("Floor 3");

      const floors = useSessionStore.getState().getOrderedFloors();
      expect(floors).toHaveLength(3);
      for (let i = 1; i < floors.length; i++) {
        expect(floors[i]!.order).toBeGreaterThan(floors[i - 1]!.order);
      }
    });
  });

  /* ── Floor-scoped event routing ───────────────────────────── */

  describe("floor-scoped event routing", () => {
    it("addEventToFloor adds event to the correct floor", () => {
      const firstFloorId = useSessionStore.getState().activeFloorId!;
      const secondFloorId = useSessionStore.getState().createFloor("Floor 2");

      useSessionStore.getState().addEventToFloor(firstFloorId, createTestEvent({ id: "e1" }));
      useSessionStore.getState().addEventToFloor(secondFloorId, createTestEvent({ id: "e2" }));

      expect(useSessionStore.getState().floors[firstFloorId]!.events).toHaveLength(1);
      expect(useSessionStore.getState().floors[secondFloorId]!.events).toHaveLength(1);
    });

    it("addEventToFloor syncs snapshot when targeting active floor", () => {
      const activeFloorId = useSessionStore.getState().activeFloorId!;
      useSessionStore.getState().addEventToFloor(activeFloorId, createTestEvent({ id: "e1" }));
      expect(useSessionStore.getState().events).toHaveLength(1);
    });

    it("addEventToFloor does not sync snapshot when targeting inactive floor", () => {
      const firstFloorId = useSessionStore.getState().activeFloorId!;
      useSessionStore.getState().createFloor("Floor 2");
      /* Active is now Floor 2, add event to Floor 1 */
      useSessionStore.getState().addEventToFloor(firstFloorId, createTestEvent({ id: "e1" }));
      /* Snapshot should reflect Floor 2 (empty) */
      expect(useSessionStore.getState().events).toEqual([]);
    });

    it("getFloorBySessionId finds the correct floor", () => {
      useSessionStore.getState().startSession({
        id: "session-1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      const floorId = useSessionStore.getState().activeFloorId!;
      expect(useSessionStore.getState().getFloorBySessionId("session-1")).toBe(floorId);
    });

    it("getFloorBySessionId returns null for unknown session", () => {
      expect(useSessionStore.getState().getFloorBySessionId("nonexistent")).toBeNull();
    });

    it("updateElfStatusOnFloor updates elf on correct floor", () => {
      const floorId = useSessionStore.getState().activeFloorId!;
      useSessionStore.getState().addElf(createTestElf({ id: "e1", status: "spawning" }));
      useSessionStore.getState().updateElfStatusOnFloor(floorId, "e1", "working");

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.elves[0]!.status).toBe("working");
      /* Snapshot should also be synced */
      expect(useSessionStore.getState().elves[0]!.status).toBe("working");
    });

    it("updateAllElfStatusOnFloor updates all elves on floor", () => {
      const floorId = useSessionStore.getState().activeFloorId!;
      useSessionStore.getState().addElf(createTestElf({ id: "e1", status: "working" }));
      useSessionStore.getState().addElf(createTestElf({ id: "e2", status: "thinking" }));
      useSessionStore.getState().updateAllElfStatusOnFloor(floorId, "done");

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.elves.every((e) => e.status === "done")).toBe(true);
    });

    it("endSessionOnFloor sets session status on correct floor", () => {
      useSessionStore.getState().startSession({
        id: "session-1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      const floorId = useSessionStore.getState().activeFloorId!;
      useSessionStore.getState().endSessionOnFloor(floorId, "completed");

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.session!.status).toBe("completed");
    });
  });

  /* ── Historical floors ────────────────────────────────────── */

  describe("historical floors", () => {
    it("openHistoricalFloor creates a floor with session and events", () => {
      const session: ActiveSession = {
        id: "hist-1",
        projectId: "p1",
        task: "Historical task",
        runtime: "claude-code",
        status: "completed",
        startedAt: Date.now() - 60000,
        plan: null,
      };
      const events = [createTestEvent({ id: "e-hist-1" })];
      const floorId = useSessionStore.getState().openHistoricalFloor(session, events);

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.isHistorical).toBe(true);
      expect(floor.session!.id).toBe("hist-1");
      expect(floor.events).toHaveLength(1);
      expect(useSessionStore.getState().activeFloorId).toBe(floorId);
    });

    it("openHistoricalFloor extracts sleeping elves from spawn events", () => {
      const session: ActiveSession = {
        id: "hist-2",
        projectId: "p1",
        task: "Task with elves",
        runtime: "claude-code",
        status: "completed",
        startedAt: Date.now() - 60000,
        plan: null,
      };
      const events = [
        createTestEvent({
          id: "spawn-1",
          type: "spawn",
          elfId: "elf-a",
          elfName: "Spark",
          payload: { role: "engineer", avatar: "⚡", color: "#FF6B6B", quirk: "Leaves glitter" },
        }),
        createTestEvent({
          id: "spawn-2",
          type: "spawn",
          elfId: "elf-b",
          elfName: "Tinker",
          payload: { role: "researcher", avatar: "🔧", color: "#4D96FF" },
        }),
        createTestEvent({ id: "output-1", type: "output", elfId: "elf-a" }),
      ];
      const floorId = useSessionStore.getState().openHistoricalFloor(session, events);

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.elves).toHaveLength(2);
      expect(floor.elves[0]!.id).toBe("elf-a");
      expect(floor.elves[0]!.name).toBe("Spark");
      expect(floor.elves[0]!.status).toBe("sleeping");
      expect(floor.elves[0]!.role).toBe("engineer");
      expect(floor.elves[1]!.id).toBe("elf-b");
      expect(floor.elves[1]!.name).toBe("Tinker");
      expect(floor.elves[1]!.status).toBe("sleeping");
    });

    it("openHistoricalFloor deduplicates elves by elfId", () => {
      const session: ActiveSession = {
        id: "hist-3",
        projectId: "p1",
        task: "Dedup test",
        runtime: "claude-code",
        status: "completed",
        startedAt: Date.now() - 60000,
        plan: null,
      };
      const events = [
        createTestEvent({ id: "spawn-1", type: "spawn", elfId: "elf-a", elfName: "Spark", payload: {} }),
        createTestEvent({ id: "spawn-2", type: "spawn", elfId: "elf-a", elfName: "Spark", payload: {} }),
      ];
      const floorId = useSessionStore.getState().openHistoricalFloor(session, events);

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.elves).toHaveLength(1);
    });

    it("openHistoricalFloor creates placeholder elf when no spawn events exist", () => {
      const session: ActiveSession = {
        id: "hist-4",
        projectId: "p1",
        task: "No spawns",
        runtime: "claude-code",
        status: "completed",
        startedAt: Date.now() - 60000,
        plan: null,
      };
      const events = [
        createTestEvent({ id: "output-1", type: "output" }),
      ];
      const floorId = useSessionStore.getState().openHistoricalFloor(session, events);

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.elves).toHaveLength(1);
      expect(floor.elves[0]!.id).toContain("placeholder");
      expect(floor.elves[0]!.status).toBe("sleeping");
      expect(floor.elves[0]!.name).toBe("Elf");
    });
  });

  /* ── clearFloorSession ────────────────────────────────────── */

  describe("clearFloorSession", () => {
    it("resets a floor to idle state while keeping the tab", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addEvent(createTestEvent());
      const floorId = useSessionStore.getState().activeFloorId!;

      useSessionStore.getState().clearFloorSession(floorId);

      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.session).toBeNull();
      expect(floor.events).toEqual([]);
      expect(floor.label).toBe("New Floor");
      expect(useSessionStore.getState().activeSession).toBeNull();
    });
  });

  /* ── Snapshot sync (backward-compatible session actions) ──── */

  describe("initial state", () => {
    it("starts with no active session", () => {
      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.events).toEqual([]);
      expect(state.elves).toEqual([]);
      expect(state.thinkingStream).toEqual([]);
      expect(state.isPlanPreview).toBe(false);
      expect(state.pendingPlan).toBeNull();
    });
  });

  describe("startSession", () => {
    it("creates an active session with the provided parameters", () => {
      useSessionStore.getState().startSession({
        id: "session-1",
        projectId: "project-1",
        task: "Fix the login bug",
        runtime: "claude-code",
      });

      const state = useSessionStore.getState();
      expect(state.activeSession).not.toBeNull();
      expect(state.activeSession!.id).toBe("session-1");
      expect(state.activeSession!.projectId).toBe("project-1");
      expect(state.activeSession!.task).toBe("Fix the login bug");
      expect(state.activeSession!.runtime).toBe("claude-code");
      expect(state.activeSession!.status).toBe("active");
      expect(state.activeSession!.startedAt).toBeGreaterThan(0);
      expect(state.activeSession!.plan).toBeNull();
    });

    it("stores the plan when provided", () => {
      const plan = createTestPlan();
      useSessionStore.getState().startSession({
        id: "session-1",
        projectId: "project-1",
        task: "Research competitors",
        runtime: "claude-code",
        plan,
      });

      const state = useSessionStore.getState();
      expect(state.activeSession!.plan).not.toBeNull();
      expect(state.activeSession!.plan!.agentCount).toBe(2);
      expect(state.activeSession!.plan!.complexity).toBe("team");
    });

    it("clears previous events and elves when starting a new session", () => {
      const store = useSessionStore.getState();
      store.startSession({ id: "s1", projectId: "p1", task: "task 1", runtime: "claude-code" });
      store.addEvent(createTestEvent());
      store.addElf(createTestElf());

      store.startSession({ id: "s2", projectId: "p1", task: "task 2", runtime: "codex" });

      const state = useSessionStore.getState();
      expect(state.activeSession!.id).toBe("s2");
      expect(state.events).toEqual([]);
      expect(state.elves).toEqual([]);
      expect(state.thinkingStream).toEqual([]);
    });

    it("updates the floor label to task text", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "Fix the login bug", runtime: "claude-code",
      });
      const floorId = useSessionStore.getState().activeFloorId!;
      const floor = useSessionStore.getState().floors[floorId]!;
      expect(floor.label).toBe("Fix the login bug");
    });
  });

  describe("endSession", () => {
    it("sets status to completed when passed explicitly", () => {
      useSessionStore.getState().startSession({
        id: "session-1",
        projectId: "project-1",
        task: "task",
        runtime: "claude-code",
      });
      useSessionStore.getState().endSession("completed");

      const state = useSessionStore.getState();
      expect(state.activeSession!.status).toBe("completed");
    });

    it("sets status to cancelled when passed explicitly", () => {
      useSessionStore.getState().startSession({
        id: "session-1",
        projectId: "project-1",
        task: "task",
        runtime: "claude-code",
      });
      useSessionStore.getState().endSession("cancelled");

      const state = useSessionStore.getState();
      expect(state.activeSession!.status).toBe("cancelled");
    });

    it("sets status to ended when no status is provided", () => {
      useSessionStore.getState().startSession({
        id: "session-1",
        projectId: "project-1",
        task: "task",
        runtime: "claude-code",
      });
      useSessionStore.getState().endSession();

      const state = useSessionStore.getState();
      expect(state.activeSession!.status).toBe("ended");
    });

    it("does nothing when there is no active session", () => {
      useSessionStore.getState().endSession("completed");
      expect(useSessionStore.getState().activeSession).toBeNull();
    });
  });

  describe("addEvent", () => {
    it("appends an event to the stream", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });

      const event = createTestEvent({ id: "e1" });
      useSessionStore.getState().addEvent(event);

      expect(useSessionStore.getState().events).toHaveLength(1);
      expect(useSessionStore.getState().events[0]!.id).toBe("e1");
    });

    it("preserves event ordering", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });

      useSessionStore.getState().addEvent(createTestEvent({ id: "e1" }));
      useSessionStore.getState().addEvent(createTestEvent({ id: "e2" }));
      useSessionStore.getState().addEvent(createTestEvent({ id: "e3" }));

      const events = useSessionStore.getState().events;
      expect(events).toHaveLength(3);
      expect(events[0]!.id).toBe("e1");
      expect(events[1]!.id).toBe("e2");
      expect(events[2]!.id).toBe("e3");
    });
  });

  describe("addElf", () => {
    it("adds an elf to the list", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });

      const elf = createTestElf({ id: "e1" });
      useSessionStore.getState().addElf(elf);

      expect(useSessionStore.getState().elves).toHaveLength(1);
      expect(useSessionStore.getState().elves[0]!.id).toBe("e1");
    });

    it("supports multiple elves", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });

      useSessionStore.getState().addElf(createTestElf({ id: "e1", name: "Spark" }));
      useSessionStore.getState().addElf(createTestElf({ id: "e2", name: "Tinker" }));

      expect(useSessionStore.getState().elves).toHaveLength(2);
    });
  });

  describe("updateElfStatus", () => {
    it("updates the status of a specific elf", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addElf(createTestElf({ id: "e1", status: "spawning" }));

      useSessionStore.getState().updateElfStatus("e1", "working");

      expect(useSessionStore.getState().elves[0]!.status).toBe("working");
    });

    it("does not affect other elves", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addElf(createTestElf({ id: "e1", status: "spawning" }));
      useSessionStore.getState().addElf(createTestElf({ id: "e2", status: "working" }));

      useSessionStore.getState().updateElfStatus("e1", "done");

      expect(useSessionStore.getState().elves[0]!.status).toBe("done");
      expect(useSessionStore.getState().elves[1]!.status).toBe("working");
    });

    it("is a no-op for unknown elf IDs", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addElf(createTestElf({ id: "e1", status: "spawning" }));

      useSessionStore.getState().updateElfStatus("nonexistent", "error");

      expect(useSessionStore.getState().elves[0]!.status).toBe("spawning");
    });
  });

  describe("updateAllElfStatus", () => {
    it("updates all elves to the given status", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addElf(createTestElf({ id: "e1", status: "working" }));
      useSessionStore.getState().addElf(createTestElf({ id: "e2", status: "waiting" }));
      useSessionStore.getState().addElf(createTestElf({ id: "e3", status: "thinking" }));

      useSessionStore.getState().updateAllElfStatus("done");

      const elves = useSessionStore.getState().elves;
      expect(elves.every((elf) => elf.status === "done")).toBe(true);
    });
  });

  describe("thinkingStream", () => {
    it("appends thinking fragments", () => {
      useSessionStore.getState().addThinkingFragment("First thought...");
      useSessionStore.getState().addThinkingFragment("Second thought...");

      const stream = useSessionStore.getState().thinkingStream;
      expect(stream).toHaveLength(2);
      expect(stream[0]).toBe("First thought...");
      expect(stream[1]).toBe("Second thought...");
    });
  });

  describe("planPreview", () => {
    it("shows plan preview with pending plan", () => {
      const plan = createTestPlan();
      useSessionStore.getState().showPlanPreview(plan);

      const state = useSessionStore.getState();
      expect(state.isPlanPreview).toBe(true);
      expect(state.pendingPlan).not.toBeNull();
      expect(state.pendingPlan!.agentCount).toBe(2);
    });

    it("acceptPlan exits preview phase", () => {
      const plan = createTestPlan();
      useSessionStore.getState().showPlanPreview(plan);
      useSessionStore.getState().acceptPlan();

      const state = useSessionStore.getState();
      expect(state.isPlanPreview).toBe(false);
    });
  });

  describe("updateTaskNodeStatus", () => {
    it("updates a task node status in the active plan", () => {
      const plan = createTestPlan();
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "Research", runtime: "claude-code", plan,
      });

      useSessionStore.getState().updateTaskNodeStatus("t1", "active");

      const state = useSessionStore.getState();
      expect(state.activeSession!.plan!.taskGraph[0]!.status).toBe("active");
      expect(state.activeSession!.plan!.taskGraph[1]!.status).toBe("pending");
    });

    it("is a no-op when no active plan exists", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });

      useSessionStore.getState().updateTaskNodeStatus("t1", "done");

      expect(useSessionStore.getState().activeSession!.plan).toBeNull();
    });
  });

  describe("clearSession", () => {
    it("resets all state to initial values", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addEvent(createTestEvent());
      useSessionStore.getState().addElf(createTestElf());
      useSessionStore.getState().addThinkingFragment("thought");
      useSessionStore.getState().showPlanPreview(createTestPlan());

      useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.events).toEqual([]);
      expect(state.elves).toEqual([]);
      expect(state.thinkingStream).toEqual([]);
      expect(state.isPlanPreview).toBe(false);
      expect(state.pendingPlan).toBeNull();
    });
  });

  /* ── Multi-floor isolation ────────────────────────────────── */

  describe("multi-floor isolation", () => {
    it("sessions on different floors are independent", () => {
      /* Start session on floor 1 */
      useSessionStore.getState().startSession({
        id: "session-1", projectId: "p1", task: "Task 1", runtime: "claude-code",
      });
      useSessionStore.getState().addElf(createTestElf({ id: "e1" }));
      useSessionStore.getState().addEvent(createTestEvent({ id: "ev1" }));
      const floor1Id = useSessionStore.getState().activeFloorId!;

      /* Create floor 2 and start a different session */
      useSessionStore.getState().createFloor("Floor 2");
      useSessionStore.getState().startSession({
        id: "session-2", projectId: "p1", task: "Task 2", runtime: "codex",
      });
      useSessionStore.getState().addElf(createTestElf({ id: "e2" }));
      /* Verify floor 2 state */
      expect(useSessionStore.getState().activeSession!.id).toBe("session-2");
      expect(useSessionStore.getState().elves).toHaveLength(1);
      expect(useSessionStore.getState().events).toEqual([]);

      /* Switch to floor 1 and verify its state is intact */
      useSessionStore.getState().switchFloor(floor1Id);
      expect(useSessionStore.getState().activeSession!.id).toBe("session-1");
      expect(useSessionStore.getState().elves).toHaveLength(1);
      expect(useSessionStore.getState().elves[0]!.id).toBe("e1");
      expect(useSessionStore.getState().events).toHaveLength(1);
    });

    it("events routed to inactive floor accumulate correctly", () => {
      /* Start session on floor 1 */
      useSessionStore.getState().startSession({
        id: "session-1", projectId: "p1", task: "Task 1", runtime: "claude-code",
      });
      const floor1Id = useSessionStore.getState().activeFloorId!;

      /* Create and switch to floor 2 */
      useSessionStore.getState().createFloor("Floor 2");

      /* Route events to floor 1 (now inactive) */
      useSessionStore.getState().addEventToFloor(floor1Id, createTestEvent({ id: "ev1" }));
      useSessionStore.getState().addEventToFloor(floor1Id, createTestEvent({ id: "ev2" }));

      /* Snapshot should show floor 2 (empty) */
      expect(useSessionStore.getState().events).toEqual([]);

      /* Switch to floor 1 — events are there */
      useSessionStore.getState().switchFloor(floor1Id);
      expect(useSessionStore.getState().events).toHaveLength(2);
    });
  });
});
