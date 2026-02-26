/* Active project state — tracks the currently selected project and project list. */

import { create } from "zustand";
import type { Project } from "@/types/project";

interface ProjectState {
  /** All projects loaded from the database */
  readonly projects: readonly Project[];
  /** Currently selected project ID (null = no project selected) */
  readonly activeProjectId: string | null;

  /** Replace the full project list (e.g., after loading from backend) */
  setProjects: (projects: Project[]) => void;
  /** Select a project by ID */
  setActiveProject: (id: string | null) => void;
  /** Add a newly created project to the list and select it */
  addProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProjectId: null,

  setProjects: (projects: Project[]) => set({ projects }),
  setActiveProject: (id: string | null) => set({ activeProjectId: id }),
  addProject: (project: Project) =>
    set((state) => ({
      projects: [project, ...state.projects],
      activeProjectId: project.id,
    })),
}));
