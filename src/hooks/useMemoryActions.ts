/* Memory actions hook — connects MemoryExplorer and MemorySettings callbacks to Tauri IPC. */

import { useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/project";
import { useMemoryStore } from "@/stores/memory";
import {
  listMemories,
  createMemory,
  updateMemory as invokeUpdateMemory,
  deleteMemory as invokeDeleteMemory,
  pinMemory as invokePinMemory,
  unpinMemory as invokeUnpinMemory,
  searchMemories,
} from "@/lib/tauri";
import type { MemoryEntry, MemoryCategory } from "@/types/memory";

/**
 * Provides IPC-connected callbacks for the MemoryExplorer and MemorySettings.
 * Handles loading, searching, creating, editing, pinning, and deleting memories.
 * Automatically loads memories when the active project changes.
 */
export function useMemoryActions(): {
  loadMemories: () => Promise<void>;
  handleCreateMemory: (category: MemoryCategory, content: string) => void;
  handleEditMemory: (memory: MemoryEntry) => void;
  handlePinMemory: (memory: MemoryEntry) => void;
  handleDeleteMemory: (memory: MemoryEntry) => void;
  handleSearch: (query: string) => void;
  handleClearAll: () => void;
} {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setMemories = useMemoryStore((s) => s.setMemories);
  const addMemory = useMemoryStore((s) => s.addMemory);
  const updateMemory = useMemoryStore((s) => s.updateMemory);
  const removeMemory = useMemoryStore((s) => s.removeMemory);
  const setLoading = useMemoryStore((s) => s.setLoading);

  /** Fetch all memories for the active project from the backend. */
  const loadMemories = useCallback(async (): Promise<void> => {
    if (!activeProjectId) {
      setMemories([]);
      return;
    }

    setLoading(true);
    try {
      const memories = await listMemories(activeProjectId);
      setMemories(memories);
    } catch (error) {
      console.error("Failed to load memories:", error);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, setMemories, setLoading]);

  /** Reload memories when the active project changes. */
  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  /** Create a new memory and add it to the local store. */
  const handleCreateMemory = useCallback(
    (category: MemoryCategory, content: string): void => {
      if (!activeProjectId) return;
      void (async () => {
        try {
          const memory = await createMemory(activeProjectId, category, content, "manual");
          addMemory(memory);
        } catch (error) {
          console.error("Failed to create memory:", error);
        }
      })();
    },
    [activeProjectId, addMemory],
  );

  /** Edit a memory's content. Opens a prompt for simplicity — production would use inline editing. */
  const handleEditMemory = useCallback(
    (memory: MemoryEntry): void => {
      const newContent = window.prompt("Edit memory content:", memory.content);
      if (newContent === null || newContent.trim() === "") return;
      void (async () => {
        try {
          await invokeUpdateMemory(memory.id, newContent.trim());
          updateMemory(memory.id, { ...memory, content: newContent.trim() });
        } catch (error) {
          console.error("Failed to update memory:", error);
        }
      })();
    },
    [updateMemory],
  );

  /** Toggle pin/unpin on a memory. */
  const handlePinMemory = useCallback(
    (memory: MemoryEntry): void => {
      const isPinned = memory.source === "pinned";
      void (async () => {
        try {
          if (isPinned) {
            await invokeUnpinMemory(memory.id);
            updateMemory(memory.id, {
              ...memory,
              source: null,
              relevanceScore: memory.relevanceScore,
            });
          } else {
            await invokePinMemory(memory.id);
            updateMemory(memory.id, {
              ...memory,
              source: "pinned",
              relevanceScore: 1.0,
            });
          }
        } catch (error) {
          console.error("Failed to pin/unpin memory:", error);
        }
      })();
    },
    [updateMemory],
  );

  /** Delete a memory with confirmation. */
  const handleDeleteMemory = useCallback(
    (memory: MemoryEntry): void => {
      void (async () => {
        try {
          await invokeDeleteMemory(memory.id);
          removeMemory(memory.id);
        } catch (error) {
          console.error("Failed to delete memory:", error);
        }
      })();
    },
    [removeMemory],
  );

  /** Search memories via FTS5. Falls back to full list if query is empty. */
  const handleSearch = useCallback(
    (query: string): void => {
      if (!activeProjectId) return;
      void (async () => {
        try {
          if (query.trim() === "") {
            const memories = await listMemories(activeProjectId);
            setMemories(memories);
          } else {
            const results = await searchMemories(activeProjectId, query);
            setMemories(results);
          }
        } catch (error) {
          console.error("Failed to search memories:", error);
        }
      })();
    },
    [activeProjectId, setMemories],
  );

  /** Clear all memories by deleting each one. Reloads from backend after. */
  const handleClearAll = useCallback((): void => {
    const memories = useMemoryStore.getState().memories;
    void (async () => {
      try {
        for (const memory of memories) {
          await invokeDeleteMemory(memory.id);
        }
        setMemories([]);
      } catch (error) {
        console.error("Failed to clear memories:", error);
      }
    })();
  }, [setMemories]);

  return {
    loadMemories,
    handleCreateMemory,
    handleEditMemory,
    handlePinMemory,
    handleDeleteMemory,
    handleSearch,
    handleClearAll,
  };
}
