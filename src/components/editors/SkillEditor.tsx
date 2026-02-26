/* SkillEditor — split panel skill browser and markdown editor with neo-brutalist styling. */

import { useState, useCallback, useEffect } from "react";
import { useSkillStore } from "@/stores/skills";
import { useSkillActions } from "@/hooks/useSkillActions";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEmptyState } from "@/lib/funny-copy";
import type { Skill } from "@/types/skill";

/** Default template content for new skills. */
const NEW_SKILL_TEMPLATE = `## Skill Name

Describe what this skill does and when elves should use it.

### Instructions

1. Step one
2. Step two
3. Step three

### Examples

\`\`\`
Example usage here
\`\`\`
`;

/**
 * Split-panel skill editor: left panel lists skills (global + project), right panel
 * shows the editor for the active skill with metadata fields and a textarea.
 */
export function SkillEditor(): React.JSX.Element {
  const skills = useSkillStore((s) => s.skills);
  const activeSkillId = useSkillStore((s) => s.activeSkillId);
  const setActiveSkillId = useSkillStore((s) => s.setActiveSkillId);
  const isLoading = useSkillStore((s) => s.isLoading);
  const {
    handleCreateSkill,
    handleUpdateSkill,
    handleDeleteSkill,
  } = useSkillActions();

  /* Local editor state */
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const activeSkill = skills.find((s) => s.id === activeSkillId) ?? null;

  /** Load skill data into editor when active skill changes. */
  useEffect(() => {
    if (activeSkill) {
      setEditName(activeSkill.name);
      setEditDescription(activeSkill.description ?? "");
      setEditContent(activeSkill.content);
      setEditTrigger(activeSkill.triggerPattern ?? "");
      setIsDirty(false);
    }
  }, [activeSkill]);

  const handleFieldChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>) => {
      return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
        setter(event.target.value);
        setIsDirty(true);
      };
    },
    [],
  );

  const handleSave = useCallback((): void => {
    if (!activeSkill || !editName.trim()) return;
    void handleUpdateSkill(
      activeSkill.id,
      editName.trim(),
      editContent,
      editDescription.trim() || undefined,
      editTrigger.trim() || undefined,
    );
    setIsDirty(false);
  }, [activeSkill, editName, editContent, editDescription, editTrigger, handleUpdateSkill]);

  const handleNewSkill = useCallback((): void => {
    void handleCreateSkill("New Skill", NEW_SKILL_TEMPLATE, "A new custom skill");
  }, [handleCreateSkill]);

  const handleDelete = useCallback((): void => {
    if (!activeSkill) return;
    handleDeleteSkill(activeSkill.id);
  }, [activeSkill, handleDeleteSkill]);

  /* Group skills: global first, then project-scoped */
  const globalSkills = skills.filter((s) => s.projectId === null);
  const projectSkills = skills.filter((s) => s.projectId !== null);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="font-display text-xl font-bold text-text-light/40">Loading skills...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full" data-testid="skill-editor">
      {/* Left panel — skill list */}
      <div className="flex w-64 shrink-0 flex-col border-r-[3px] border-border bg-white">
        {/* List header */}
        <div className="flex items-center justify-between border-b-[3px] border-border p-3">
          <h2 className="font-display text-lg font-black uppercase tracking-tight">Skills</h2>
          <Button variant="primary" className="px-3 py-1 text-xs" onClick={handleNewSkill}>
            + New
          </Button>
        </div>

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto">
          {skills.length === 0 ? (
            <div className="p-4">
              <p className="font-body text-sm text-text-light/40">No skills yet</p>
            </div>
          ) : (
            <div>
              {/* Global skills */}
              {globalSkills.length > 0 && (
                <div>
                  <p className="border-b-[2px] border-border/20 px-3 py-2 font-body text-xs font-bold uppercase tracking-wider text-text-light/50">
                    Global
                  </p>
                  {globalSkills.map((skill) => (
                    <SkillListItem
                      key={skill.id}
                      skill={skill}
                      isActive={activeSkillId === skill.id}
                      onClick={() => setActiveSkillId(skill.id)}
                    />
                  ))}
                </div>
              )}

              {/* Project skills */}
              {projectSkills.length > 0 && (
                <div>
                  <p className="border-b-[2px] border-border/20 px-3 py-2 font-body text-xs font-bold uppercase tracking-wider text-text-light/50">
                    Project
                  </p>
                  {projectSkills.map((skill) => (
                    <SkillListItem
                      key={skill.id}
                      skill={skill}
                      isActive={activeSkillId === skill.id}
                      onClick={() => setActiveSkillId(skill.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — editor */}
      <div className="flex flex-1 flex-col">
        {activeSkill ? (
          <>
            {/* Metadata header */}
            <div className="border-b-[3px] border-border p-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editName}
                  onChange={handleFieldChange(setEditName)}
                  className="flex-1 border-[2px] border-border bg-white px-3 py-2 font-display text-lg font-bold outline-none focus:shadow-[3px_3px_0px_0px_#FFD93D]"
                  placeholder="Skill name"
                  data-testid="skill-name-input"
                />
                {isDirty && <Badge variant="warning">Unsaved</Badge>}
              </div>
              <input
                type="text"
                value={editDescription}
                onChange={handleFieldChange(setEditDescription)}
                className="mt-2 w-full border-[2px] border-border/40 bg-white px-3 py-2 font-body text-sm outline-none focus:border-border focus:shadow-[3px_3px_0px_0px_#FFD93D]"
                placeholder="Description (optional)"
                data-testid="skill-description-input"
              />
              <input
                type="text"
                value={editTrigger}
                onChange={handleFieldChange(setEditTrigger)}
                className="mt-2 w-full border-[2px] border-border/40 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-border focus:shadow-[3px_3px_0px_0px_#FFD93D]"
                placeholder="Trigger pattern (e.g., /deploy)"
                data-testid="skill-trigger-input"
              />
            </div>

            {/* Editor area */}
            <div className="flex flex-1 flex-col p-4">
              <textarea
                value={editContent}
                onChange={handleFieldChange(setEditContent)}
                className="flex-1 resize-none border-[3px] border-border bg-white p-4 font-mono text-sm leading-relaxed outline-none focus:shadow-[4px_4px_0px_0px_#FFD93D]"
                placeholder="Write your skill content in markdown..."
                data-testid="skill-content-editor"
              />
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-2 border-t-[3px] border-border p-3">
              <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
                Save
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center" data-testid="skill-editor-empty">
            {skills.length === 0 ? (
              (() => {
                const empty = getEmptyState("no-skills");
                return <EmptyState message={`${empty.emoji} ${empty.title}`} submessage={empty.subtitle} />;
              })()
            ) : (
              <EmptyState
                message="Select a skill to edit"
                submessage="Choose from the list on the left, or create a new one."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Individual skill item in the left panel list. */
function SkillListItem({
  skill,
  isActive,
  onClick,
}: {
  readonly skill: Skill;
  readonly isActive: boolean;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full border-b-[2px] border-border/10 px-3 py-3 text-left transition-all duration-100",
        isActive
          ? "border-l-[4px] border-l-elf-gold bg-elf-gold-light"
          : "cursor-pointer hover:bg-elf-gold-light/50",
      ].join(" ")}
      data-testid="skill-list-item"
    >
      <p className="font-body text-sm font-bold">{skill.name}</p>
      {skill.description && (
        <p className="mt-0.5 truncate font-body text-xs text-text-light/50">{skill.description}</p>
      )}
    </button>
  );
}
