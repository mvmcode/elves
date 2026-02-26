/* Memory store — client-side state for the memory explorer UI. */

import { create } from "zustand";
import type { MemoryEntry, MemoryCategory } from "@/types/memory";

interface MemoryState {
  /** All loaded memory entries for the active project */
  readonly memories: readonly MemoryEntry[];
  /** Current search query (debounced in the UI layer) */
  readonly searchQuery: string;
  /** Active category filter (null = show all) */
  readonly activeCategory: MemoryCategory | null;
  /** Whether memories are being fetched from the backend */
  readonly isLoading: boolean;

  /** Replace the full memory list */
  setMemories: (memories: readonly MemoryEntry[]) => void;
  /** Update the search query string */
  setSearchQuery: (query: string) => void;
  /** Set active category filter (null clears) */
  setActiveCategory: (category: MemoryCategory | null) => void;
  /** Append a single memory to the list */
  addMemory: (memory: MemoryEntry) => void;
  /** Update an existing memory by ID (replaces the entry) */
  updateMemory: (id: number, updated: MemoryEntry) => void;
  /** Remove a memory by ID */
  removeMemory: (id: number) => void;
  /** Set the loading state */
  setLoading: (loading: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  searchQuery: "",
  activeCategory: null,
  isLoading: false,

  setMemories: (memories: readonly MemoryEntry[]) => set({ memories }),

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  setActiveCategory: (activeCategory: MemoryCategory | null) => set({ activeCategory }),

  addMemory: (memory: MemoryEntry) =>
    set((state) => ({ memories: [...state.memories, memory] })),

  updateMemory: (id: number, updated: MemoryEntry) =>
    set((state) => ({
      memories: state.memories.map((m) => (m.id === id ? updated : m)),
    })),

  removeMemory: (id: number) =>
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
    })),

  setLoading: (isLoading: boolean) => set({ isLoading }),
}));
