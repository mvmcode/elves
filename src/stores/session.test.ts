/* Tests for the session store — verifies all state transitions and actions. */

import { describe, expect, it, beforeEach } from "vitest";
import { useSessionStore } from "./session";
import type { Minion, MinionEvent } from "@/types/minion";

/** Reset store state between tests */
function resetStore(): void {
  useSessionStore.getState().clearSession();
}

/** Factory for a minimal valid Minion */
function createTestMinion(overrides: Partial<Minion> = {}): Minion {
  return {
    id: "minion-1",
    sessionId: "session-1",
    name: "Kevin",
    role: "engineer",
    avatar: "🔬",
    color: "#FF6B6B",
    quirk: "Narrates everything in third person",
    runtime: "claude-code",
    status: "spawning",
    spawnedAt: Date.now(),
    finishedAt: null,
    parentMinionId: null,
    toolsUsed: [],
    ...overrides,
  };
}

/** Factory for a minimal valid MinionEvent */
function createTestEvent(overrides: Partial<MinionEvent> = {}): MinionEvent {
  return {
    id: "event-1",
    timestamp: Date.now(),
    minionId: "minion-1",
    minionName: "Kevin",
    runtime: "claude-code",
    type: "output",
    payload: { text: "Hello world" },
    ...overrides,
  };
}

describe("useSessionStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("starts with no active session", () => {
      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.events).toEqual([]);
      expect(state.minions).toEqual([]);
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
    });

    it("clears previous events and minions when starting a new session", () => {
      const store = useSessionStore.getState();
      store.startSession({ id: "s1", projectId: "p1", task: "task 1", runtime: "claude-code" });
      store.addEvent(createTestEvent());
      store.addMinion(createTestMinion());

      store.startSession({ id: "s2", projectId: "p1", task: "task 2", runtime: "codex" });

      const state = useSessionStore.getState();
      expect(state.activeSession!.id).toBe("s2");
      expect(state.events).toEqual([]);
      expect(state.minions).toEqual([]);
    });
  });

  describe("endSession", () => {
    it("sets status to completed when summary is provided", () => {
      useSessionStore.getState().startSession({
        id: "session-1",
        projectId: "project-1",
        task: "task",
        runtime: "claude-code",
      });
      useSessionStore.getState().endSession("All done!");

      const state = useSessionStore.getState();
      expect(state.activeSession!.status).toBe("completed");
    });

    it("sets status to ended when no summary is provided", () => {
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
      useSessionStore.getState().endSession("summary");
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

  describe("addMinion", () => {
    it("adds a minion to the list", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });

      const minion = createTestMinion({ id: "m1" });
      useSessionStore.getState().addMinion(minion);

      expect(useSessionStore.getState().minions).toHaveLength(1);
      expect(useSessionStore.getState().minions[0]!.id).toBe("m1");
    });

    it("supports multiple minions", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });

      useSessionStore.getState().addMinion(createTestMinion({ id: "m1", name: "Kevin" }));
      useSessionStore.getState().addMinion(createTestMinion({ id: "m2", name: "Stuart" }));

      expect(useSessionStore.getState().minions).toHaveLength(2);
    });
  });

  describe("updateMinionStatus", () => {
    it("updates the status of a specific minion", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addMinion(createTestMinion({ id: "m1", status: "spawning" }));

      useSessionStore.getState().updateMinionStatus("m1", "working");

      expect(useSessionStore.getState().minions[0]!.status).toBe("working");
    });

    it("does not affect other minions", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addMinion(createTestMinion({ id: "m1", status: "spawning" }));
      useSessionStore.getState().addMinion(createTestMinion({ id: "m2", status: "working" }));

      useSessionStore.getState().updateMinionStatus("m1", "done");

      expect(useSessionStore.getState().minions[0]!.status).toBe("done");
      expect(useSessionStore.getState().minions[1]!.status).toBe("working");
    });

    it("is a no-op for unknown minion IDs", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addMinion(createTestMinion({ id: "m1", status: "spawning" }));

      useSessionStore.getState().updateMinionStatus("nonexistent", "error");

      expect(useSessionStore.getState().minions[0]!.status).toBe("spawning");
    });
  });

  describe("clearSession", () => {
    it("resets all state to initial values", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addEvent(createTestEvent());
      useSessionStore.getState().addMinion(createTestMinion());

      useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.events).toEqual([]);
      expect(state.minions).toEqual([]);
    });
  });
});
