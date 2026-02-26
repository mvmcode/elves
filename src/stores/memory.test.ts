/* Tests for the memory store — verifies all state actions. */

import { describe, expect, it, beforeEach } from "vitest";
import { useMemoryStore } from "./memory";
import type { MemoryEntry } from "@/types/memory";

/** Reset store state between tests */
function resetStore(): void {
  useMemoryStore.setState({
    memories: [],
    searchQuery: "",
    activeCategory: null,
    isLoading: false,
  });
}

/** Factory for a minimal valid MemoryEntry */
function createTestMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 1,
    projectId: "project-1",
    category: "context",
    content: "The project uses Tauri v2 with React frontend.",
    source: null,
    tags: "",
    createdAt: 1700000000,
    accessedAt: 1700000000,
    relevanceScore: 0.85,
    ...overrides,
  };
}

describe("useMemoryStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("starts with empty memories and default values", () => {
      const state = useMemoryStore.getState();
      expect(state.memories).toEqual([]);
      expect(state.searchQuery).toBe("");
      expect(state.activeCategory).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setMemories", () => {
    it("replaces the full memory list", () => {
      const memories = [
        createTestMemory({ id: 1 }),
        createTestMemory({ id: 2, category: "decision" }),
      ];
      useMemoryStore.getState().setMemories(memories);

      expect(useMemoryStore.getState().memories).toHaveLength(2);
      expect(useMemoryStore.getState().memories[0]!.id).toBe(1);
      expect(useMemoryStore.getState().memories[1]!.id).toBe(2);
    });

    it("replaces previous memories entirely", () => {
      useMemoryStore.getState().setMemories([createTestMemory({ id: 1 })]);
      useMemoryStore.getState().setMemories([createTestMemory({ id: 99 })]);

      expect(useMemoryStore.getState().memories).toHaveLength(1);
      expect(useMemoryStore.getState().memories[0]!.id).toBe(99);
    });
  });

  describe("setSearchQuery", () => {
    it("updates the search query", () => {
      useMemoryStore.getState().setSearchQuery("tauri");
      expect(useMemoryStore.getState().searchQuery).toBe("tauri");
    });
  });

  describe("setActiveCategory", () => {
    it("sets the active category filter", () => {
      useMemoryStore.getState().setActiveCategory("decision");
      expect(useMemoryStore.getState().activeCategory).toBe("decision");
    });

    it("clears the filter when set to null", () => {
      useMemoryStore.getState().setActiveCategory("learning");
      useMemoryStore.getState().setActiveCategory(null);
      expect(useMemoryStore.getState().activeCategory).toBeNull();
    });
  });

  describe("addMemory", () => {
    it("appends a memory to the list", () => {
      useMemoryStore.getState().addMemory(createTestMemory({ id: 1 }));
      expect(useMemoryStore.getState().memories).toHaveLength(1);
    });

    it("preserves existing memories", () => {
      useMemoryStore.getState().addMemory(createTestMemory({ id: 1 }));
      useMemoryStore.getState().addMemory(createTestMemory({ id: 2 }));
      expect(useMemoryStore.getState().memories).toHaveLength(2);
    });
  });

  describe("updateMemory", () => {
    it("replaces a memory by ID", () => {
      useMemoryStore.getState().setMemories([
        createTestMemory({ id: 1, content: "old content" }),
        createTestMemory({ id: 2, content: "other" }),
      ]);

      const updated = createTestMemory({ id: 1, content: "new content" });
      useMemoryStore.getState().updateMemory(1, updated);

      expect(useMemoryStore.getState().memories[0]!.content).toBe("new content");
      expect(useMemoryStore.getState().memories[1]!.content).toBe("other");
    });

    it("is a no-op for unknown IDs", () => {
      useMemoryStore.getState().setMemories([createTestMemory({ id: 1 })]);
      const updated = createTestMemory({ id: 999, content: "ghost" });
      useMemoryStore.getState().updateMemory(999, updated);

      expect(useMemoryStore.getState().memories).toHaveLength(1);
      expect(useMemoryStore.getState().memories[0]!.id).toBe(1);
    });
  });

  describe("removeMemory", () => {
    it("removes a memory by ID", () => {
      useMemoryStore.getState().setMemories([
        createTestMemory({ id: 1 }),
        createTestMemory({ id: 2 }),
      ]);
      useMemoryStore.getState().removeMemory(1);

      expect(useMemoryStore.getState().memories).toHaveLength(1);
      expect(useMemoryStore.getState().memories[0]!.id).toBe(2);
    });

    it("is a no-op for unknown IDs", () => {
      useMemoryStore.getState().setMemories([createTestMemory({ id: 1 })]);
      useMemoryStore.getState().removeMemory(999);
      expect(useMemoryStore.getState().memories).toHaveLength(1);
    });
  });

  describe("setLoading", () => {
    it("sets loading to true", () => {
      useMemoryStore.getState().setLoading(true);
      expect(useMemoryStore.getState().isLoading).toBe(true);
    });

    it("sets loading to false", () => {
      useMemoryStore.getState().setLoading(true);
      useMemoryStore.getState().setLoading(false);
      expect(useMemoryStore.getState().isLoading).toBe(false);
    });
  });
});
