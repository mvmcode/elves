/* Skill actions hook — connects SkillEditor to Tauri IPC for skill CRUD. */

import { useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/project";
import { useSkillStore } from "@/stores/skills";
import {
  listSkills,
  createSkill as invokeCreateSkill,
  updateSkill as invokeUpdateSkill,
  deleteSkill as invokeDeleteSkill,
  discoverSkillsFromClaude,
} from "@/lib/tauri";

/**
 * Provides IPC-connected callbacks for the SkillEditor.
 * Handles loading, creating, updating, and deleting skills.
 * Automatically loads skills when the active project changes.
 */
export function useSkillActions(): {
  loadSkills: () => Promise<void>;
  handleCreateSkill: (name: string, content: string, description?: string, triggerPattern?: string) => Promise<void>;
  handleUpdateSkill: (id: string, name: string, content: string, description?: string, triggerPattern?: string) => Promise<void>;
  handleDeleteSkill: (id: string) => void;
  handleImportFromClaude: () => Promise<number>;
} {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setSkills = useSkillStore((s) => s.setSkills);
  const addSkill = useSkillStore((s) => s.addSkill);
  const updateSkill = useSkillStore((s) => s.updateSkill);
  const removeSkill = useSkillStore((s) => s.removeSkill);
  const setLoading = useSkillStore((s) => s.setLoading);

  /** Fetch all skills (global + project-scoped) from the backend. */
  const loadSkills = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const skills = await listSkills(activeProjectId ?? undefined);
      setSkills(skills);
    } catch (error) {
      console.error("Failed to load skills:", error);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, setSkills, setLoading]);

  /** Reload skills when the active project changes. */
  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  /** Create a new skill. */
  const handleCreateSkill = useCallback(
    async (name: string, content: string, description?: string, triggerPattern?: string): Promise<void> => {
      try {
        const skill = await invokeCreateSkill(name, content, activeProjectId ?? undefined, description, triggerPattern);
        addSkill(skill);
      } catch (error) {
        console.error("Failed to create skill:", error);
      }
    },
    [activeProjectId, addSkill],
  );

  /** Update an existing skill. */
  const handleUpdateSkill = useCallback(
    async (id: string, name: string, content: string, description?: string, triggerPattern?: string): Promise<void> => {
      try {
        await invokeUpdateSkill(id, name, content, description, triggerPattern);
        const skills = useSkillStore.getState().skills;
        const existing = skills.find((s) => s.id === id);
        if (existing) {
          updateSkill(id, {
            ...existing,
            name,
            content,
            description: description ?? existing.description,
            triggerPattern: triggerPattern ?? existing.triggerPattern,
            updatedAt: Date.now(),
          });
        }
      } catch (error) {
        console.error("Failed to update skill:", error);
      }
    },
    [updateSkill],
  );

  /** Delete a skill by ID. */
  const handleDeleteSkill = useCallback(
    (id: string): void => {
      void (async () => {
        try {
          await invokeDeleteSkill(id);
          removeSkill(id);
        } catch (error) {
          console.error("Failed to delete skill:", error);
        }
      })();
    },
    [removeSkill],
  );

  /**
   * Import skills from Claude Code command files (~/.claude/commands/ and project-level).
   * Skips skills that already exist (matched by trigger pattern). Returns imported count.
   */
  const handleImportFromClaude = useCallback(async (): Promise<number> => {
    const projects = useProjectStore.getState().projects;
    const projectId = useProjectStore.getState().activeProjectId;
    const activeProject = projects.find((p) => p.id === projectId);
    try {
      const discovered = await discoverSkillsFromClaude(activeProject?.path);
      if (discovered.length === 0) return 0;

      const existingSkills = useSkillStore.getState().skills;
      const existingTriggers = new Set(
        existingSkills
          .map((s) => s.triggerPattern)
          .filter((t): t is string => t !== null),
      );

      let importedCount = 0;
      for (const skill of discovered) {
        if (existingTriggers.has(skill.triggerPattern)) continue;
        try {
          const created = await invokeCreateSkill(
            skill.name,
            skill.content,
            skill.scope === "project" ? (projectId ?? undefined) : undefined,
            skill.description || undefined,
            skill.triggerPattern,
          );
          addSkill(created);
          importedCount++;
        } catch (error) {
          console.error(`Failed to import skill ${skill.name}:`, error);
        }
      }
      return importedCount;
    } catch (error) {
      console.error("Failed to discover Claude skills:", error);
      return 0;
    }
  }, [addSkill]);

  return {
    loadSkills,
    handleCreateSkill,
    handleUpdateSkill,
    handleDeleteSkill,
    handleImportFromClaude,
  };
}
