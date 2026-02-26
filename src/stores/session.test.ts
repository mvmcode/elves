/* Tests for the session store — verifies all state transitions and actions. */

import { describe, expect, it, beforeEach } from "vitest";
import { useSessionStore } from "./session";
import type { Elf, ElfEvent } from "@/types/elf";

/** Reset store state between tests */
function resetStore(): void {
  useSessionStore.getState().clearSession();
}

/** Factory for a minimal valid Elf */
function createTestElf(overrides: Partial<Elf> = {}): Elf {
  return {
    id: "elf-1",
    sessionId: "session-1",
    name: "Spark",
    role: "engineer",
    avatar: "⚡",
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

describe("useSessionStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("starts with no active session", () => {
      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.events).toEqual([]);
      expect(state.elves).toEqual([]);
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

  describe("clearSession", () => {
    it("resets all state to initial values", () => {
      useSessionStore.getState().startSession({
        id: "s1", projectId: "p1", task: "task", runtime: "claude-code",
      });
      useSessionStore.getState().addEvent(createTestEvent());
      useSessionStore.getState().addElf(createTestElf());

      useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.events).toEqual([]);
      expect(state.elves).toEqual([]);
    });
  });
});
