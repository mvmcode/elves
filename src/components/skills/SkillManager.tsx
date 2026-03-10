/* SkillManager — top-level container for the Skills view with My Skills and Catalog tabs. */

import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app";
import { useProjectStore } from "@/stores/project";
import { useSkillStore } from "@/stores/skills";
import { useSkillActions } from "@/hooks/useSkillActions";
import { getRuntimeControlConfig } from "@/lib/runtime-controls";
import { listSkillSources } from "@/lib/tauri";
import { EmptyState } from "@/components/shared/EmptyState";
import { SkillSidebar } from "./SkillSidebar";
import { SkillDetailEditor } from "./SkillDetailEditor";
import { SkillCatalog } from "./SkillCatalog";
import { SkillPreviewModal } from "./SkillPreviewModal";

type SkillTab = "my-skills" | "catalog";

/**
 * Top-level skill management container. Renders two tabs:
 * - "My Skills": sidebar + detail editor side-by-side
 * - "Catalog": flat searchable skill catalog
 * Preview modal overlays when content is selected.
 */
export function SkillManager(): React.JSX.Element {
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const controlConfig = getRuntimeControlConfig(defaultRuntime);
  const previewContent = useSkillStore((s) => s.previewContent);

  const { loadSkills } = useSkillActions();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setSources = useSkillStore((s) => s.setSources);

  useEffect(() => {
    void loadSkills();
    void listSkillSources().then((sources) => setSources(sources)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const [activeTab, setActiveTab] = useState<SkillTab>("my-skills");

  if (!controlConfig.supportsSkills) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="skill-editor-unsupported">
        <EmptyState
          message="Skills for Codex — Coming Soon"
          submessage="Codex now supports skills, and ELVES integration is on the way. Switch to Claude Code to use skills now."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col" data-testid="skill-manager">
      <div className="flex border-b-token-normal border-border">
        {(["my-skills", "catalog"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "my-skills" ? "My Skills" : "Catalog";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "cursor-pointer px-6 py-3 font-display text-sm font-bold uppercase tracking-wide",
                "border-[2px] border-border border-b-[3px] transition-all duration-100",
                isActive
                  ? "bg-accent text-black border-b-accent shadow-brutal-sm"
                  : "bg-surface-elevated text-text-light hover:bg-accent-light border-b-transparent",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
        <div className="flex-1 border-b-[3px] border-b-transparent" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {activeTab === "my-skills" ? (
          <>
            <SkillSidebar />
            <SkillDetailEditor />
          </>
        ) : (
          <SkillCatalog />
        )}
      </div>

      {previewContent && <SkillPreviewModal />}
    </div>
  );
}
