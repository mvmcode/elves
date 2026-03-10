/* Skill actions hook — connects skill UI to Tauri IPC for skill CRUD and catalog operations. */

import { useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { useSkillStore } from "@/stores/skills";
import { useToastStore } from "@/stores/toast";
import {
  listSkills,
  createSkill as invokeCreateSkill,
  updateSkill as invokeUpdateSkill,
  deleteSkill as invokeDeleteSkill,
  discoverSkillsFromClaude,
  refreshSkillCatalog,
  listSkillSources,
  previewSkillContent,
  toggleSkill,
  checkSkillUpdates,
  searchSkillsV2,
  listAllCatalogSkills,
  installSkill,
} from "@/lib/tauri";

/**
 * Provides IPC-connected callbacks for skill management.
 * Handles loading, creating, updating, deleting, searching, and installing skills.
 */
export function useSkillActions(): {
  loadSkills: () => Promise<void>;
  handleCreateSkill: (name: string, content: string, description?: string, triggerPattern?: string) => Promise<void>;
  handleUpdateSkill: (id: string, name: string, content: string, description?: string, triggerPattern?: string) => Promise<void>;
  handleDeleteSkill: (id: string) => void;
  handleImportFromClaude: () => Promise<number>;
  handleRefreshCatalog: () => Promise<void>;
  handleLoadCatalog: () => Promise<void>;
  handlePreviewSkill: (repoName: string, filePath: string) => Promise<void>;
  handleInstallSkill: (itemId: string) => Promise<void>;
  handleToggleSkill: (id: string, enabled: boolean) => Promise<void>;
  handleCheckUpdates: () => Promise<void>;
  handleSearchV2: (query: string) => Promise<void>;
} {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setSkills = useSkillStore((s) => s.setSkills);
  const addSkill = useSkillStore((s) => s.addSkill);
  const updateSkill = useSkillStore((s) => s.updateSkill);
  const removeSkill = useSkillStore((s) => s.removeSkill);
  const setLoading = useSkillStore((s) => s.setLoading);
  const setSearching = useSkillStore((s) => s.setSearching);
  const setSearchError = useSkillStore((s) => s.setSearchError);

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

  const handleRefreshCatalog = useCallback(async (): Promise<void> => {
    const store = useSkillStore.getState();
    store.setRefreshingCatalog(true);
    try {
      await refreshSkillCatalog();
      const [sources, items] = await Promise.all([
        listSkillSources(),
        listAllCatalogSkills(),
      ]);
      store.setSources(sources);
      store.setCatalogItems(items);
    } catch (err) {
      console.error("Failed to refresh catalog:", err);
    } finally {
      useSkillStore.getState().setRefreshingCatalog(false);
    }
  }, []);

  const handleLoadCatalog = useCallback(async (): Promise<void> => {
    try {
      const items = await listAllCatalogSkills();
      useSkillStore.getState().setCatalogItems(items);
    } catch (err) {
      console.error("Failed to load catalog:", err);
    }
  }, []);

  const handlePreviewSkill = useCallback(async (repoName: string, filePath: string): Promise<void> => {
    try {
      const content = await previewSkillContent(repoName, filePath);
      useSkillStore.getState().setPreviewContent(content);
    } catch (err) {
      console.error("Failed to preview skill:", err);
    }
  }, []);

  const handleInstallSkill = useCallback(async (itemId: string): Promise<void> => {
    const projects = useProjectStore.getState().projects;
    const projectId = useProjectStore.getState().activeProjectId;
    const activeProject = projects.find((p) => p.id === projectId);

    try {
      await installSkill(itemId, activeProject?.path);
      await loadSkills();
      useToastStore.getState().addToast({ message: "Skill installed successfully", variant: "success", duration: 3000 });
    } catch (err) {
      console.error("Failed to install skill:", err);
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast({ message: `Install failed: ${message}`, variant: "error", duration: 5000 });
    }
  }, [loadSkills]);

  const handleToggleSkill = useCallback(async (id: string, enabled: boolean): Promise<void> => {
    try {
      await toggleSkill(id, enabled);
      const skills = useSkillStore.getState().skills;
      const updated = skills.map((s) => (s.id === id ? { ...s, enabled } : s));
      useSkillStore.getState().setSkills(updated);
    } catch (err) {
      console.error("Failed to toggle skill:", err);
    }
  }, []);

  const handleCheckUpdates = useCallback(async (): Promise<void> => {
    try {
      const updates = await checkSkillUpdates();
      useSkillStore.getState().setAvailableUpdates(updates);
    } catch (err) {
      console.error("Failed to check updates:", err);
    }
  }, []);

  const handleSearchV2 = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      useSkillStore.getState().setSearchResultsV2(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const results = await searchSkillsV2(query);
      useSkillStore.getState().setSearchResultsV2(results);
    } catch (err) {
      console.error("V2 skill search failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      setSearchError(message);
      useSkillStore.getState().setSearchResultsV2(null);
    } finally {
      setSearching(false);
    }
  }, [setSearching, setSearchError]);

  return {
    loadSkills,
    handleCreateSkill,
    handleUpdateSkill,
    handleDeleteSkill,
    handleImportFromClaude,
    handleRefreshCatalog,
    handleLoadCatalog,
    handlePreviewSkill,
    handleInstallSkill,
    handleToggleSkill,
    handleCheckUpdates,
    handleSearchV2,
  };
}
