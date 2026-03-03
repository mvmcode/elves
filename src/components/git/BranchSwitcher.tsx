/* BranchSwitcher — dropdown popover listing local branches with click-to-switch,
 * plus a worktree section when multiple worktrees exist. */

import { useState, useRef, useEffect, useCallback } from "react";
import { useGitStore } from "@/stores/git";
import { useProjectStore } from "@/stores/project";
import type { WorktreeInfo } from "@/types/git-state";

/** Truncate a file path to its last two segments for compact display. */
function truncatePath(fullPath: string): string {
  const segments = fullPath.replace(/\/$/, "").split("/");
  if (segments.length <= 2) return fullPath;
  return `…/${segments.slice(-2).join("/")}`;
}

export function BranchSwitcher(): React.JSX.Element {
  const branch = useGitStore((s) => s.branch);
  const worktrees = useGitStore((s) => s.worktrees);
  const switchBranch = useGitStore((s) => s.switchBranch);
  const activeProject = useProjectStore((s) => {
    const id = s.activeProjectId;
    return id ? s.projects.find((p) => p.id === id) : undefined;
  });

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleSwitch = useCallback(
    (branchName: string): void => {
      if (!activeProject || branchName === branch?.current) return;
      void switchBranch(activeProject.path, branchName);
      setIsOpen(false);
    },
    [activeProject, branch?.current, switchBranch],
  );

  /** Close popover on outside click. */
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!branch) return <span className="font-mono text-[10px] text-text-light/40">no repo</span>;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button — shows current branch name */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex cursor-pointer items-center gap-1 border-[2px] border-border/30 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-text-light transition-all duration-100 hover:border-border hover:shadow-brutal-xs"
        title={`Branch: ${branch.current}`}
        data-testid="branch-switcher-trigger"
      >
        {/* Git branch icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 01-9 9" />
        </svg>
        <span className="max-w-[120px] truncate">{branch.current}</span>
      </button>

      {/* Dropdown popover */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1 max-h-[240px] w-[220px] overflow-y-auto border-[3px] border-border bg-white shadow-brutal-md"
          data-testid="branch-switcher-dropdown"
        >
          <div className="border-b-[2px] border-border/30 px-3 py-1.5">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-text-light/50">
              Local Branches
            </span>
          </div>
          {branch.local.map((name) => (
            <button
              key={name}
              onClick={() => handleSwitch(name)}
              className={[
                "flex w-full cursor-pointer items-center gap-2 border-none px-3 py-1.5 text-left font-mono text-xs transition-colors duration-75",
                name === branch.current
                  ? "bg-elf-gold/20 font-bold text-text-light"
                  : "bg-transparent text-text-light/70 hover:bg-elf-gold/10 hover:text-text-light",
              ].join(" ")}
              data-testid={`branch-option-${name}`}
            >
              {name === branch.current && (
                <span className="text-success">●</span>
              )}
              <span className="truncate">{name}</span>
            </button>
          ))}

          {/* Worktrees section — only when multiple worktrees exist */}
          {worktrees.length > 1 && (
            <>
              <div className="border-t-[2px] border-border/30 px-3 py-1.5">
                <span className="font-display text-[10px] font-bold uppercase tracking-wider text-text-light/50">
                  Worktrees
                </span>
              </div>
              {worktrees.map((wt: WorktreeInfo) => (
                <div
                  key={wt.path}
                  className="flex w-full items-center gap-2 px-3 py-1.5 font-mono text-xs text-text-light/70"
                  title={wt.path}
                  data-testid={`worktree-${wt.branch}`}
                >
                  {/* Folder icon */}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  </svg>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[11px] font-bold">{wt.branch}</span>
                    <span className="truncate text-[9px] text-text-light/40">{truncatePath(wt.path)}</span>
                  </div>
                  {/* Badges */}
                  <div className="flex shrink-0 items-center gap-1">
                    {wt.isMain && (
                      <span className="border-[1.5px] border-border/30 px-1 py-0 text-[8px] font-bold uppercase text-text-light/50">
                        main
                      </span>
                    )}
                    {wt.isLocked && (
                      <span className="border-[1.5px] border-border/30 bg-elf-gold/20 px-1 py-0 text-[8px] font-bold uppercase text-elf-gold">
                        locked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {branch.remote.length > 0 && (
            <>
              <div className="border-t-[2px] border-border/30 px-3 py-1.5">
                <span className="font-display text-[10px] font-bold uppercase tracking-wider text-text-light/50">
                  Remote
                </span>
              </div>
              {branch.remote.map((name) => (
                <div
                  key={name}
                  className="px-3 py-1 font-mono text-[10px] text-text-light/40"
                >
                  {name}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
