/* SkillDetailEditor — right panel editor for the active skill in the "My Skills" tab. */

import { useState, useCallback, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { useSkillStore } from "@/stores/skills";
import { useSkillActions } from "@/hooks/useSkillActions";
import { useTeamSession } from "@/hooks/useTeamSession";
import { writeTextToFile } from "@/lib/tauri";
import { MarkdownLite } from "@/lib/markdown-lite";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEmptyState } from "@/lib/funny-copy";

type ViewMode = "edit" | "split" | "preview";

/**
 * Editor panel for the currently selected skill — name, description, trigger,
 * markdown content with live preview, and save/export/test/delete actions.
 */
export function SkillDetailEditor(): React.JSX.Element {
  const skills = useSkillStore((s) => s.skills);
  const activeSkillId = useSkillStore((s) => s.activeSkillId);
  const activeSkill = skills.find((s) => s.id === activeSkillId) ?? null;

  const { handleUpdateSkill, handleDeleteSkill } = useSkillActions();
  const { analyzeAndDeploy } = useTeamSession();

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

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
    setSaveStatus("Saving...");
    void handleUpdateSkill(
      activeSkill.id,
      editName.trim(),
      editContent,
      editDescription.trim() || undefined,
      editTrigger.trim() || undefined,
    ).then(() => {
      setIsDirty(false);
      setSaveStatus("Saved");
      setTimeout(() => setSaveStatus(null), 2000);
    }).catch(() => {
      setSaveStatus("Save failed");
      setTimeout(() => setSaveStatus(null), 3000);
    });
  }, [activeSkill, editName, editContent, editDescription, editTrigger, handleUpdateSkill]);

  const handleDelete = useCallback((): void => {
    if (!activeSkill) return;
    handleDeleteSkill(activeSkill.id);
  }, [activeSkill, handleDeleteSkill]);

  const handleExport = useCallback((): void => {
    void (async () => {
      const filePath = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: `${editName || "skill"}.md`,
      });
      if (!filePath) return;
      await writeTextToFile(filePath, editContent);
    })();
  }, [editName, editContent]);

  const handleTestSkill = useCallback((): void => {
    if (!editContent.trim()) return;
    void analyzeAndDeploy(editContent);
  }, [editContent, analyzeAndDeploy]);

  if (!activeSkill) {
    return (
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
    );
  }

  const modes: { mode: ViewMode; label: string }[] = [
    { mode: "edit", label: "Edit" },
    { mode: "split", label: "Split" },
    { mode: "preview", label: "Preview" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* Metadata header */}
      <div className="border-b-token-normal border-border p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={editName}
            onChange={handleFieldChange(setEditName)}
            className="flex-1 border-token-thin border-border bg-surface-elevated rounded-token-md px-3 py-2 font-display text-lg font-bold outline-none focus:focus-ring"
            placeholder="Skill name"
          />
          {isDirty && <Badge variant="warning">Unsaved</Badge>}
          {saveStatus && <Badge variant={saveStatus === "Save failed" ? "error" : "success"}>{saveStatus}</Badge>}
          {/* View mode toggle */}
          <div className="flex" role="group" aria-label="View mode">
            {modes.map(({ mode, label }, index) => {
              const isActive = viewMode === mode;
              const isFirst = index === 0;
              const isLast = index === modes.length - 1;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  aria-pressed={isActive}
                  className={[
                    "px-3 py-1 font-body text-xs font-bold uppercase tracking-wide transition-all duration-100",
                    "border-[2px] border-border",
                    !isFirst ? "-ml-[2px]" : "",
                    isFirst ? "rounded-l-sm" : "",
                    isLast ? "rounded-r-sm" : "",
                    isActive
                      ? "bg-accent text-black z-10"
                      : "bg-surface-elevated text-text-light hover:bg-accent-light",
                  ].join(" ")}
                  style={isActive ? { boxShadow: "2px 2px 0px 0px #000" } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <input
          type="text"
          value={editDescription}
          onChange={handleFieldChange(setEditDescription)}
          className="mt-2 w-full border-token-thin border-border/40 bg-surface-elevated rounded-token-md px-3 py-2 font-body text-sm outline-none focus:border-border focus:focus-ring"
          placeholder="Description (optional)"
        />
        <input
          type="text"
          value={editTrigger}
          onChange={handleFieldChange(setEditTrigger)}
          className="mt-2 w-full border-token-thin border-border/40 bg-surface-elevated rounded-token-md px-3 py-2 font-mono text-sm outline-none focus:border-border focus:focus-ring"
          placeholder="Trigger pattern (e.g., /deploy)"
        />
      </div>

      {/* Editor / Preview area */}
      <div className="flex flex-1 overflow-hidden p-4 gap-3">
        {viewMode !== "preview" && (
          <textarea
            value={editContent}
            onChange={handleFieldChange(setEditContent)}
            className="flex-1 resize-none border-token-normal border-border bg-surface-elevated rounded-token-md p-4 font-mono text-sm leading-relaxed outline-none focus:focus-ring"
            placeholder="Write your skill content in markdown..."
          />
        )}
        {viewMode !== "edit" && (
          <div
            className="flex-1 overflow-y-auto border-[3px] border-border bg-surface-elevated rounded-token-md p-4"
            style={{ boxShadow: "4px 4px 0px 0px #000" }}
          >
            {editContent.trim() ? (
              <MarkdownLite text={editContent} />
            ) : (
              <p className="font-body text-sm text-text-light/40 italic">Preview will appear here...</p>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t-token-normal border-border p-3">
        <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
          Save
        </Button>
        <Button variant="secondary" onClick={handleExport}>
          Export .md
        </Button>
        <Button variant="secondary" onClick={handleTestSkill}>
          Test Skill
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
