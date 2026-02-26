/* Template store — client-side state for the template library UI. */

import { create } from "zustand";
import type { Template } from "@/types/template";

interface TemplateState {
  /** All loaded templates (built-in + custom) */
  readonly templates: readonly Template[];
  /** Whether templates are being fetched */
  readonly isLoading: boolean;

  /** Replace the full template list */
  setTemplates: (templates: readonly Template[]) => void;
  /** Add a newly created template */
  addTemplate: (template: Template) => void;
  /** Remove a template by ID */
  removeTemplate: (id: string) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  isLoading: false,

  setTemplates: (templates: readonly Template[]) => set({ templates }),

  addTemplate: (template: Template) =>
    set((state) => ({ templates: [...state.templates, template] })),

  removeTemplate: (id: string) =>
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    })),

  setLoading: (isLoading: boolean) => set({ isLoading }),
}));
