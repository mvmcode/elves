/* Template actions hook — connects TemplateLibrary to Tauri IPC for template CRUD. */

import { useCallback, useEffect } from "react";
import { useTemplateStore } from "@/stores/templates";
import {
  listTemplates,
  saveTemplate as invokeSaveTemplate,
  deleteTemplate as invokeDeleteTemplate,
  loadTemplate as invokeLoadTemplate,
} from "@/lib/tauri";
import type { Template } from "@/types/template";
import type { TaskPlan } from "@/types/session";

/**
 * Provides IPC-connected callbacks for the TemplateLibrary.
 * Handles loading, saving, deleting, and applying templates.
 * Automatically loads templates on mount.
 */
export function useTemplateActions(): {
  loadTemplates: () => Promise<void>;
  handleSaveTemplate: (name: string, plan: TaskPlan, description?: string) => Promise<void>;
  handleDeleteTemplate: (template: Template) => void;
  handleLoadTemplate: (templateId: string) => Promise<Template | null>;
} {
  const setTemplates = useTemplateStore((s) => s.setTemplates);
  const addTemplate = useTemplateStore((s) => s.addTemplate);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);
  const setLoading = useTemplateStore((s) => s.setLoading);

  /** Fetch all templates from the backend. */
  const loadTemplates = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const templates = await listTemplates();
      setTemplates(templates);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }, [setTemplates, setLoading]);

  /** Load templates on mount. */
  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  /** Save a plan as a template. */
  const handleSaveTemplate = useCallback(
    async (name: string, plan: TaskPlan, description?: string): Promise<void> => {
      try {
        const template = await invokeSaveTemplate(name, JSON.stringify(plan), description);
        addTemplate(template);
      } catch (error) {
        console.error("Failed to save template:", error);
      }
    },
    [addTemplate],
  );

  /** Delete a custom template. */
  const handleDeleteTemplate = useCallback(
    (template: Template): void => {
      if (template.builtIn) return;
      void (async () => {
        try {
          await invokeDeleteTemplate(template.id);
          removeTemplate(template.id);
        } catch (error) {
          console.error("Failed to delete template:", error);
        }
      })();
    },
    [removeTemplate],
  );

  /** Load a specific template by ID. Returns the full template or null on error. */
  const handleLoadTemplate = useCallback(
    async (templateId: string): Promise<Template | null> => {
      try {
        return await invokeLoadTemplate(templateId);
      } catch (error) {
        console.error("Failed to load template:", error);
        return null;
      }
    },
    [],
  );

  return {
    loadTemplates,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleLoadTemplate,
  };
}
