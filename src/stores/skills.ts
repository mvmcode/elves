/* Skills store — client-side state for the skill editor UI. */

import { create } from "zustand";
import type { Skill } from "@/types/skill";

interface SkillState {
  /** All loaded skills (global + project) */
  readonly skills: readonly Skill[];
  /** Currently selected skill ID for editing (null = none) */
  readonly activeSkillId: string | null;
  /** Whether skills are being loaded */
  readonly isLoading: boolean;

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
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  activeSkillId: null,
  isLoading: false,

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
}));
