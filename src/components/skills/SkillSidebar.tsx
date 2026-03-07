/* SkillSidebar — left panel for "My Skills" tab: skill list, search, create/import actions. */

import { useState, useCallback, useEffect, useRef } from "react";
import { useSkillStore } from "@/stores/skills";
import { useSkillActions } from "@/hooks/useSkillActions";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { SkillListItem } from "./SkillListItem";

/**
 * Left panel listing all installed skills grouped into Global and Project sections.
 * Search bar filters installed skills only. Discovery happens in the Catalog tab.
 */
export function SkillSidebar(): React.JSX.Element {
  const skills = useSkillStore((s) => s.skills);
  const activeSkillId = useSkillStore((s) => s.activeSkillId);
  const setActiveSkillId = useSkillStore((s) => s.setActiveSkillId);
  const searchQuery = useSkillStore((s) => s.searchQuery);
  const searchResultsV2 = useSkillStore((s) => s.searchResultsV2);
  const isSearching = useSkillStore((s) => s.isSearching);
  const searchError = useSkillStore((s) => s.searchError);
  const setSearchQuery = useSkillStore((s) => s.setSearchQuery);
  const setSearchError = useSkillStore((s) => s.setSearchError);
  const clearSearch = useSkillStore((s) => s.clearSearch);

  const {
    handleCreateSkill,
    handleImportFromClaude,
    handleSearchV2,
    handleToggleSkill,
  } = useSkillActions();

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { clearSearch(); }, [clearSearch]);

  useEffect(() => {
    if (isSearching) {
      setSearchElapsed(0);
      searchTimerRef.current = setInterval(() => setSearchElapsed((p) => p + 1), 1000);
    } else {
      if (searchTimerRef.current) { clearInterval(searchTimerRef.current); searchTimerRef.current = null; }
      setSearchElapsed(0);
    }
    return () => { if (searchTimerRef.current) clearInterval(searchTimerRef.current); };
  }, [isSearching]);

  const handleNewSkill = useCallback((): void => {
    void handleCreateSkill("New Skill", "## New Skill\n\nDescribe what this skill does.\n", "A new custom skill");
  }, [handleCreateSkill]);

  const handleImport = useCallback((): void => {
    setImportStatus("Importing...");
    void handleImportFromClaude().then((count) => {
      setImportStatus(count > 0 ? `Imported ${count}` : "No new skills");
      setTimeout(() => setImportStatus(null), 3000);
    });
  }, [handleImportFromClaude]);

  const handleSearchSubmit = useCallback((): void => {
    void handleSearchV2(searchQuery);
  }, [searchQuery, handleSearchV2]);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter") void handleSearchV2(searchQuery);
      if (event.key === "Escape") clearSearch();
    },
    [searchQuery, handleSearchV2, clearSearch],
  );

  const globalSkills = skills.filter((s) => s.projectId === null);
  const projectSkills = skills.filter((s) => s.projectId !== null);
  const hasSearchContent = searchResultsV2 !== null || searchError !== null;
  const localResults = searchResultsV2?.local ?? [];

  return (
    <div className="flex w-72 shrink-0 flex-col border-r-token-normal border-border bg-surface-elevated">
      <div className="flex flex-col gap-2 border-b-token-normal border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-heading tracking-tight">My Skills</h2>
            <Badge variant="default">{skills.length}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1 px-3 py-1 text-xs" onClick={handleNewSkill}>
            + New
          </Button>
          <Button variant="secondary" className="flex-1 px-3 py-1 text-xs" onClick={handleImport}>
            {importStatus ?? "Import"}
          </Button>
        </div>
      </div>

      <div className="border-b-token-normal border-border p-3" data-testid="skill-search">
        <div className="flex gap-1">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full border-token-thin border-border bg-surface-elevated rounded-token-md px-2 py-1.5 pr-6 font-body text-xs outline-none focus:focus-ring"
              placeholder="Search installed skills..."
              disabled={isSearching}
              data-testid="skill-search-input"
            />
            {(searchQuery || hasSearchContent) && !isSearching && (
              <button
                onClick={clearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 font-body text-sm text-text-light/40 hover:text-text-light"
                title="Clear search"
              >
                x
              </button>
            )}
          </div>
          {isSearching ? (
            <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => {
              useSkillStore.getState().setSearching(false);
              useSkillStore.getState().setSearchPhase(null);
            }}>
              Cancel
            </Button>
          ) : (
            <Button variant="primary" className="px-2 py-1 text-xs" onClick={handleSearchSubmit} disabled={!searchQuery.trim()}>
              Search
            </Button>
          )}
        </div>

        {isSearching && (
          <div className="mt-2 flex items-center gap-2" data-testid="skill-search-progress">
            <span className="inline-block h-2 w-2 animate-pulse border-[1px] border-border bg-accent" />
            <span className="font-body text-xs font-bold">Searching...</span>
            <span className="font-mono text-xs text-text-light/50">({searchElapsed}s)</span>
          </div>
        )}

        {searchError && !isSearching && (
          <div className="mt-2 flex items-center justify-between rounded-token-sm border-token-thin border-error/40 bg-error/10 px-2 py-1.5">
            <span className="font-body text-xs font-bold text-error">{searchError}</span>
            <button onClick={() => setSearchError(null)} className="font-body text-xs text-error hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {localResults.length > 0 && (
          <div className="mt-2 flex max-h-[50vh] flex-col gap-1 overflow-y-auto" data-testid="skill-search-results">
            <div className="flex items-center justify-between">
              <p className="font-body text-xs text-text-light/50">Results ({localResults.length})</p>
              <button onClick={clearSearch} className="font-body text-xs text-text-light/50 hover:text-text-light">Close</button>
            </div>
            {localResults.map((skill) => (
              <SkillListItem
                key={skill.id}
                skill={skill}
                isActive={activeSkillId === skill.id}
                onClick={() => setActiveSkillId(skill.id)}
                onToggle={handleToggleSkill}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {skills.length === 0 ? (
          <div className="p-4">
            <p className="font-body text-sm text-text-light/40">No skills yet</p>
            <p className="mt-1 font-body text-xs text-text-light/30">Create one or browse the catalog.</p>
          </div>
        ) : (
          <div>
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
                    onToggle={handleToggleSkill}
                  />
                ))}
              </div>
            )}
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
                    onToggle={handleToggleSkill}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
