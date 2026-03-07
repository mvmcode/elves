/* SkillEditor — split panel skill browser and markdown editor with neo-brutalist styling. */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { useSkillStore } from "@/stores/skills";
import type { SearchPhase } from "@/stores/skills";
import { useSkillActions } from "@/hooks/useSkillActions";
import { useAppStore } from "@/stores/app";
import { useTeamSession } from "@/hooks/useTeamSession";
import { getRuntimeControlConfig } from "@/lib/runtime-controls";
import { writeTextToFile } from "@/lib/tauri";
import { MarkdownLite } from "@/lib/markdown-lite";
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

type ViewMode = "edit" | "split" | "preview";

/**
 * Split-panel skill editor: left panel lists skills (global + project), right panel
 * shows the editor for the active skill with metadata fields, a view mode toggle,
 * an optional markdown preview, and export/test actions.
 */
export function SkillEditor(): React.JSX.Element {
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const controlConfig = getRuntimeControlConfig(defaultRuntime);

  const skills = useSkillStore((s) => s.skills);
  const activeSkillId = useSkillStore((s) => s.activeSkillId);
  const setActiveSkillId = useSkillStore((s) => s.setActiveSkillId);
  const isLoading = useSkillStore((s) => s.isLoading);
  const searchQuery = useSkillStore((s) => s.searchQuery);
  const searchResults = useSkillStore((s) => s.searchResults);
  const isSearching = useSkillStore((s) => s.isSearching);
  const searchPhase = useSkillStore((s) => s.searchPhase);
  const searchError = useSkillStore((s) => s.searchError);
  const setSearchQuery = useSkillStore((s) => s.setSearchQuery);
  const setSearchError = useSkillStore((s) => s.setSearchError);
  const clearSearch = useSkillStore((s) => s.clearSearch);

  const {
    handleCreateSkill,
    handleUpdateSkill,
    handleDeleteSkill,
    handleImportFromClaude,
    handleSearchV2,
  } = useSkillActions();

  const { analyzeAndDeploy } = useTeamSession();

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  /* Local editor state */
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Derive installed skill names from actual skill list — not local state. */
  const installedSkillNames = useMemo(() => {
    const names = new Set<string>();
    for (const skill of skills) {
      names.add(skill.name);
    }
    return names;
  }, [skills]);

  /** Clear search state when this component unmounts (tab switch). */
  useEffect(() => {
    return () => {
      clearSearch();
    };
  }, [clearSearch]);

  /** Track elapsed seconds while searching. */
  useEffect(() => {
    if (isSearching) {
      setSearchElapsed(0);
      searchTimerRef.current = setInterval(() => {
        setSearchElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      setSearchElapsed(0);
    }
    return () => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, [isSearching]);

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

  const handleNewSkill = useCallback((): void => {
    setSaveStatus("Creating...");
    void handleCreateSkill("New Skill", NEW_SKILL_TEMPLATE, "A new custom skill").then(() => {
      setSaveStatus("Created");
      setTimeout(() => setSaveStatus(null), 2000);
    });
  }, [handleCreateSkill]);

  const handleDelete = useCallback((): void => {
    if (!activeSkill) return;
    handleDeleteSkill(activeSkill.id);
  }, [activeSkill, handleDeleteSkill]);

  const handleImport = useCallback((): void => {
    setImportStatus("Importing...");
    void handleImportFromClaude().then((count) => {
      setImportStatus(count > 0 ? `Imported ${count} skill${count > 1 ? "s" : ""}` : "No new skills found");
      setTimeout(() => setImportStatus(null), 3000);
    });
  }, [handleImportFromClaude]);

  const handleSearchSubmit = useCallback((): void => {
    void handleSearchV2(searchQuery);
  }, [searchQuery, handleSearchV2]);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter") {
        void handleSearchV2(searchQuery);
      }
      if (event.key === "Escape") {
        clearSearch();
      }
    },
    [searchQuery, handleSearchV2, clearSearch],
  );

  /** Export skill content as a .md file via native save dialog. */
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

  /** Test the skill by deploying it as a task using the current content. */
  const handleTestSkill = useCallback((): void => {
    if (!editContent.trim()) return;
    void analyzeAndDeploy(editContent);
  }, [editContent, analyzeAndDeploy]);

  /* Group skills: global first, then project-scoped */
  const globalSkills = skills.filter((s) => s.projectId === null);
  const projectSkills = skills.filter((s) => s.projectId !== null);

  const hasSearchContent = searchResults.length > 0 || searchError !== null;

  if (!controlConfig.supportsSkills) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="skill-editor-unsupported">
        <EmptyState
          message="Skills are not available for Codex"
          submessage="Skills are a Claude Code feature. Switch to Claude Code to manage custom skills."
        />
      </div>
    );
  }

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
      <div className="flex w-64 shrink-0 flex-col border-r-token-normal border-border bg-surface-elevated">
        {/* List header */}
        <div className="flex flex-col gap-2 border-b-token-normal border-border p-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-heading tracking-tight">Skills</h2>
            <Button variant="primary" className="px-3 py-1 text-xs" onClick={handleNewSkill}>
              + New
            </Button>
          </div>
          <Button
            variant="secondary"
            className="w-full px-2 py-1 text-xs"
            onClick={handleImport}
            data-testid="import-claude-skills"
          >
            {importStatus ?? "Import from Claude"}
          </Button>
        </div>

        {/* Search bar — consistent with McpManager */}
        <div className="border-b-token-normal border-border p-3" data-testid="skill-search">
          <div className="flex gap-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full border-token-thin border-border bg-surface-elevated rounded-token-md px-2 py-1.5 pr-6 font-body text-xs outline-none focus:focus-ring"
                placeholder="Search skills..."
                disabled={isSearching}
                data-testid="skill-search-input"
              />
              {/* Clear input button */}
              {(searchQuery || hasSearchContent) && !isSearching && (
                <button
                  onClick={clearSearch}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 font-body text-sm text-text-light/40 hover:text-text-light"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            {isSearching ? (
              <Button
                variant="danger"
                className="px-2 py-1 text-xs"
                onClick={() => {
                  useSkillStore.getState().setSearching(false);
                  useSkillStore.getState().setSearchPhase(null);
                }}
              >
                Cancel
              </Button>
            ) : (
              <Button
                variant="primary"
                className="px-2 py-1 text-xs"
                onClick={handleSearchSubmit}
                disabled={!searchQuery.trim()}
              >
                Search
              </Button>
            )}
          </div>

          {/* Search progress — consistent with McpManager */}
          {isSearching && (
            <div className="mt-2 flex items-center gap-2" data-testid="skill-search-progress">
              <span className="inline-block h-2 w-2 animate-pulse border-[1px] border-border bg-accent" />
              <span className="font-body text-xs font-bold">
                {getSkillSearchPhaseLabel(searchPhase)}
              </span>
              <span className="font-mono text-xs text-text-light/50">({searchElapsed}s)</span>
            </div>
          )}

          {/* Search error — consistent with McpManager */}
          {searchError && !isSearching && (
            <div className="mt-2 flex items-center justify-between rounded-token-sm border-token-thin border-error/40 bg-error/10 px-2 py-1.5" data-testid="skill-search-error">
              <span className="font-body text-xs font-bold text-error">{searchError}</span>
              <button
                onClick={() => setSearchError(null)}
                className="font-body text-xs text-error hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1" data-testid="skill-search-results">
              <div className="flex items-center justify-between">
                <p className="font-body text-xs text-text-light/50">
                  Results ({searchResults.length})
                </p>
                <button
                  onClick={clearSearch}
                  className="font-body text-xs text-text-light/50 hover:text-text-light"
                  title="Close results"
                >
                  Close
                </button>
              </div>
              {searchResults.map((result) => {
                const installed = installedSkillNames.has(result.name);
                return (
                  <div
                    key={`${result.name}-${result.category ?? ""}`}
                    className={[
                      "border-token-thin border-border bg-surface-elevated rounded-token-sm p-2",
                      installed ? "opacity-60" : "",
                    ].join(" ")}
                    data-testid="skill-search-result"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-body text-xs font-bold truncate" title={result.name}>{result.name}</p>
                      <div className="flex items-center gap-1">
                        {result.stars != null && result.stars > 0 && (
                          <span className="font-mono text-xs text-text-light/50" title="GitHub stars">
                            {result.stars.toLocaleString()}★
                          </span>
                        )}
                        {result.category && (
                          <Badge variant="default">{result.category}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 font-body text-xs text-text-light/60 line-clamp-2">
                      {result.description}
                    </p>
                    {result.installUrl && (
                      <a
                        href={result.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block truncate font-body text-xs text-info hover:underline"
                      >
                        {result.author ?? "GitHub"}
                      </a>
                    )}
                    <Button
                      variant={installed ? "secondary" : "primary"}
                      className="mt-1.5 w-full px-2 py-1 text-xs"
                      onClick={() => void handleCreateSkill(result.name, result.content ?? "", result.description ?? undefined)}
                      disabled={installed}
                    >
                      {installed ? "Installed" : "Install"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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
                  <p className="border-b-token-thin border-border/20 px-3 py-2 font-body text-xs text-label text-text-light/50">
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
                  <p className="border-b-token-thin border-border/20 px-3 py-2 font-body text-xs text-label text-text-light/50">
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
            <div className="border-b-token-normal border-border p-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editName}
                  onChange={handleFieldChange(setEditName)}
                  className="flex-1 border-token-thin border-border bg-surface-elevated rounded-token-md px-3 py-2 font-display text-lg font-bold outline-none focus:focus-ring"
                  placeholder="Skill name"
                  data-testid="skill-name-input"
                />
                {isDirty && <Badge variant="warning">Unsaved</Badge>}
                {saveStatus && <Badge variant={saveStatus === "Save failed" ? "error" : "success"}>{saveStatus}</Badge>}
                {/* View mode toggle group — neo-brutalist connected buttons */}
                <ViewModeToggle viewMode={viewMode} onChangeViewMode={setViewMode} />
              </div>
              <input
                type="text"
                value={editDescription}
                onChange={handleFieldChange(setEditDescription)}
                className="mt-2 w-full border-token-thin border-border/40 bg-surface-elevated rounded-token-md px-3 py-2 font-body text-sm outline-none focus:border-border focus:focus-ring"
                placeholder="Description (optional)"
                data-testid="skill-description-input"
              />
              <input
                type="text"
                value={editTrigger}
                onChange={handleFieldChange(setEditTrigger)}
                className="mt-2 w-full border-token-thin border-border/40 bg-surface-elevated rounded-token-md px-3 py-2 font-mono text-sm outline-none focus:border-border focus:focus-ring"
                placeholder="Trigger pattern (e.g., /deploy)"
                data-testid="skill-trigger-input"
              />
            </div>

            {/* Editor / Preview area */}
            <div className="flex flex-1 overflow-hidden p-4 gap-3">
              {/* Textarea — hidden in preview mode */}
              {viewMode !== "preview" && (
                <textarea
                  value={editContent}
                  onChange={handleFieldChange(setEditContent)}
                  className="flex-1 resize-none border-token-normal border-border bg-surface-elevated rounded-token-md p-4 font-mono text-sm leading-relaxed outline-none focus:focus-ring"
                  placeholder="Write your skill content in markdown..."
                  data-testid="skill-content-editor"
                />
              )}
              {/* Preview pane — shown in split and preview mode */}
              {viewMode !== "edit" && (
                <div
                  className="flex-1 overflow-y-auto border-[3px] border-border bg-surface-elevated rounded-token-md p-4"
                  style={{ boxShadow: "4px 4px 0px 0px #000" }}
                  data-testid="skill-preview-pane"
                >
                  {editContent.trim() ? (
                    <MarkdownLite text={editContent} />
                  ) : (
                    <p className="font-body text-sm text-text-light/40 italic">Preview will appear here…</p>
                  )}
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-2 border-t-token-normal border-border p-3">
              <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
                Save
              </Button>
              <Button variant="secondary" onClick={handleExport} data-testid="skill-export-btn">
                Export .md
              </Button>
              <Button variant="secondary" onClick={handleTestSkill} data-testid="skill-test-btn">
                Test Skill
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

/** Neo-brutalist connected toggle group for Edit / Split / Preview view modes. */
function ViewModeToggle({
  viewMode,
  onChangeViewMode,
}: {
  readonly viewMode: ViewMode;
  readonly onChangeViewMode: (mode: ViewMode) => void;
}): React.JSX.Element {
  const modes: { mode: ViewMode; label: string }[] = [
    { mode: "edit", label: "Edit" },
    { mode: "split", label: "Split" },
    { mode: "preview", label: "Preview" },
  ];

  return (
    <div className="flex" role="group" aria-label="View mode" data-testid="view-mode-toggle">
      {modes.map(({ mode, label }, index) => {
        const isActive = viewMode === mode;
        const isFirst = index === 0;
        const isLast = index === modes.length - 1;
        return (
          <button
            key={mode}
            onClick={() => onChangeViewMode(mode)}
            aria-pressed={isActive}
            className={[
              "px-3 py-1 font-body text-xs font-bold uppercase tracking-wide transition-all duration-100",
              "border-[2px] border-border",
              /* Remove duplicate middle borders between connected buttons */
              !isFirst ? "-ml-[2px]" : "",
              /* Rounded corners on first and last only */
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
  );
}

/** Map a search phase to a user-friendly label for the skill search UI. */
function getSkillSearchPhaseLabel(phase: SearchPhase): string {
  switch (phase) {
    case "fetching":
      return "Searching GitHub...";
    case "done":
      return "Done";
    case "error":
      return "Search failed";
    default:
      return "Searching...";
  }
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
        "w-full border-b-token-thin border-border/10 px-3 py-3 text-left transition-all duration-100 rounded-token-sm",
        isActive
          ? "border-l-token-thick border-l-accent bg-accent-light"
          : "cursor-pointer hover:bg-accent-light/50",
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
