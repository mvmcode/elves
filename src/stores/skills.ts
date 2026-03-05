/* Skills store — client-side state for the skill editor UI. */

import { create } from "zustand";
import type { Skill } from "@/types/skill";
import type { SkillSearchResult } from "@/types/search";

/** Search phases emitted by the Rust backend during a registry search. */
export type SearchPhase = "fetching" | "done" | "error" | null;

interface SkillState {
  /** All loaded skills (global + project) */
  readonly skills: readonly Skill[];
  /** Currently selected skill ID for editing (null = none) */
  readonly activeSkillId: string | null;
  /** Whether skills are being loaded */
  readonly isLoading: boolean;
  /** Current search query */
  readonly searchQuery: string;
  /** Search results from Claude-powered search */
  readonly searchResults: readonly SkillSearchResult[];
  /** Whether a search is in progress */
  readonly isSearching: boolean;
  /** Current search phase for progress feedback */
  readonly searchPhase: SearchPhase;
  /** Error message from a failed search */
  readonly searchError: string | null;

  /** Replace the full skills list */
  setSkills: (skills: readonly Skill[]) => void;
  /** Set the active skill for editing */
  setActiveSkillId: (id: string | null) => void;
  /** Add a newly created skill */
  addSkill: (skill: Skill) => void;
  /** Update an existing skill by ID */
  updateSkill: (id: string, updated: Skill) => void;
  /** Remove a skill by ID */
  removeSkill: (id: string) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Set search results */
  setSearchResults: (results: readonly SkillSearchResult[]) => void;
  /** Set searching state */
  setSearching: (searching: boolean) => void;
  /** Set the current search phase */
  setSearchPhase: (phase: SearchPhase) => void;
  /** Set or clear the search error message */
  setSearchError: (error: string | null) => void;
  /** Reset all search state — query, results, error, phase */
  clearSearch: () => void;
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  activeSkillId: null,
  isLoading: false,
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  searchPhase: null,
  searchError: null,

  setSkills: (skills: readonly Skill[]) => set({ skills }),

  setActiveSkillId: (activeSkillId: string | null) => set({ activeSkillId }),

  addSkill: (skill: Skill) =>
    set((state) => ({ skills: [...state.skills, skill], activeSkillId: skill.id })),

  updateSkill: (id: string, updated: Skill) =>
    set((state) => ({
      skills: state.skills.map((s) => (s.id === id ? updated : s)),
    })),

  removeSkill: (id: string) =>
    set((state) => ({
      skills: state.skills.filter((s) => s.id !== id),
      activeSkillId: state.activeSkillId === id ? null : state.activeSkillId,
    })),

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setSearchResults: (searchResults: readonly SkillSearchResult[]) => set({ searchResults }),
  setSearching: (isSearching: boolean) => set({ isSearching }),
  setSearchPhase: (searchPhase: SearchPhase) => set({ searchPhase }),
  setSearchError: (searchError: string | null) => set({ searchError }),
  clearSearch: () =>
    set({
      searchQuery: "",
      searchResults: [],
      searchError: null,
      searchPhase: null,
      isSearching: false,
    }),
}));
