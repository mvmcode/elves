/* GitPanel — full sidebar view with changes, commit input, history, and push/pull actions. */

import { useState, useEffect, useCallback, useRef } from "react";
import { useGitStore } from "@/stores/git";
import { useProjectStore } from "@/stores/project";
import { DiffViewer } from "./DiffViewer";
import type { GitFileChange } from "@/types/git";

/** Status code to human-readable label. */
function statusLabel(code: string): string {
  switch (code) {
    case "M": return "modified";
    case "A": return "added";
    case "D": return "deleted";
    case "R": return "renamed";
    case "C": return "copied";
    case "U": return "unmerged";
    case "?": return "untracked";
    default: return code;
  }
}

/** Status code to badge color class. */
function statusColor(code: string): string {
  switch (code) {
    case "M": return "bg-accent-blue text-white";
    case "A":
    case "?": return "bg-success text-white";
    case "D": return "bg-error text-white";
    default: return "bg-text-light/20 text-text-light";
  }
}

/** File change row — shows path, status badge, and stage/unstage button. */
function FileChangeRow({
  file,
  onToggle,
  onViewDiff,
}: {
  readonly file: GitFileChange;
  readonly onToggle: (file: GitFileChange) => void;
  readonly onViewDiff: (file: GitFileChange) => void;
}): React.JSX.Element {
  const fileName = file.path.split("/").pop() ?? file.path;
  const dirPath = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";

  return (
    <div className="group flex items-center gap-1.5 border-b border-border/10 px-2 py-1 hover:bg-elf-gold/5">
      {/* Status badge */}
      <span
        className={`shrink-0 rounded-sm px-1 font-mono text-[9px] font-black uppercase ${statusColor(file.status)}`}
        title={statusLabel(file.status)}
      >
        {file.status}
      </span>

      {/* File path — click to view diff */}
      <button
        onClick={() => onViewDiff(file)}
        className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent text-left font-mono text-[11px] text-text-light/80 hover:text-text-light"
        title={file.path}
      >
        {dirPath && <span className="text-text-light/30">{dirPath}/</span>}
        {fileName}
      </button>

      {/* Stage/Unstage button */}
      <button
        onClick={() => onToggle(file)}
        className="shrink-0 cursor-pointer border-[2px] border-border/30 bg-white px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-text-light/60 opacity-0 transition-all duration-100 hover:border-border hover:bg-elf-gold hover:text-text-light hover:shadow-brutal-xs group-hover:opacity-100"
      >
        {file.staged ? "−" : "+"}
      </button>
    </div>
  );
}

/**
 * Full git panel — changes (staged/unstaged), commit message, history, push/pull.
 * Polls git status every 5 seconds when visible.
 */
export function GitPanel(): React.JSX.Element {
  const branch = useGitStore((s) => s.branch);
  const commits = useGitStore((s) => s.commits);
  const stagedFiles = useGitStore((s) => s.stagedFiles);
  const unstagedFiles = useGitStore((s) => s.unstagedFiles);
  const diffText = useGitStore((s) => s.diffText);
  const loading = useGitStore((s) => s.loading);
  const error = useGitStore((s) => s.error);
  const refreshAll = useGitStore((s) => s.refreshAll);
  const stageFiles = useGitStore((s) => s.stageFiles);
  const unstageFiles = useGitStore((s) => s.unstageFiles);
  const viewDiff = useGitStore((s) => s.viewDiff);
  const commitAction = useGitStore((s) => s.commit);
  const pushAction = useGitStore((s) => s.push);
  const pullAction = useGitStore((s) => s.pull);
  const clearDiff = useGitStore((s) => s.clearDiff);
  const clearError = useGitStore((s) => s.clearError);

  const activeProject = useProjectStore((s) => {
    const id = s.activeProjectId;
    return id ? s.projects.find((p) => p.id === id) : undefined;
  });

  const [commitMessage, setCommitMessage] = useState("");
  const [pushPullStatus, setPushPullStatus] = useState<string | null>(null);
  const commitInputRef = useRef<HTMLTextAreaElement>(null);

  const projectPath = activeProject?.path;

  /** Initial load and 5-second polling. */
  useEffect(() => {
    if (!projectPath) return;
    void refreshAll(projectPath);
    const interval = setInterval(() => void refreshAll(projectPath), 5000);
    return () => clearInterval(interval);
  }, [projectPath, refreshAll]);

  const handleToggleFile = useCallback(
    (file: GitFileChange): void => {
      if (!projectPath) return;
      if (file.staged) {
        void unstageFiles(projectPath, [file.path]);
      } else {
        void stageFiles(projectPath, [file.path]);
      }
    },
    [projectPath, stageFiles, unstageFiles],
  );

  const handleViewDiff = useCallback(
    (file: GitFileChange): void => {
      if (!projectPath) return;
      void viewDiff(projectPath, file.path);
    },
    [projectPath, viewDiff],
  );

  const handleStageAll = useCallback((): void => {
    if (!projectPath || unstagedFiles.length === 0) return;
    void stageFiles(projectPath, unstagedFiles.map((f) => f.path));
  }, [projectPath, unstagedFiles, stageFiles]);

  const handleUnstageAll = useCallback((): void => {
    if (!projectPath || stagedFiles.length === 0) return;
    void unstageFiles(projectPath, stagedFiles.map((f) => f.path));
  }, [projectPath, stagedFiles, unstageFiles]);

  const handleCommit = useCallback((): void => {
    if (!projectPath || !commitMessage.trim()) return;
    void commitAction(projectPath, commitMessage.trim()).then(() => setCommitMessage(""));
  }, [projectPath, commitMessage, commitAction]);

  const handlePush = useCallback((): void => {
    if (!projectPath) return;
    setPushPullStatus("Pushing...");
    void pushAction(projectPath).then((result) => {
      setPushPullStatus(result || "Pushed successfully");
      setTimeout(() => setPushPullStatus(null), 3000);
    });
  }, [projectPath, pushAction]);

  const handlePull = useCallback((): void => {
    if (!projectPath) return;
    setPushPullStatus("Pulling...");
    void pullAction(projectPath).then((result) => {
      setPushPullStatus(result || "Pulled successfully");
      setTimeout(() => setPushPullStatus(null), 3000);
    });
  }, [projectPath, pullAction]);

  /** Handle Cmd+Enter to commit. */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleCommit();
      }
    },
    [handleCommit],
  );

  if (!activeProject) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 font-body text-sm text-text-light/40">
        Open a project to use Git
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="git-panel">
      {/* Header — branch + push/pull */}
      <div className="flex items-center justify-between border-b-[2px] border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Git</h2>
          {branch && (
            <span className="border-[2px] border-border/30 bg-white px-2 py-0.5 font-mono text-[11px] font-bold">
              {branch.current}
            </span>
          )}
          {loading && (
            <span className="font-mono text-[10px] text-text-light/30">syncing...</span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={handlePull}
            className="cursor-pointer border-[2px] border-border/40 bg-white px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-text-light/60 transition-all duration-100 hover:border-border hover:bg-accent-blue hover:text-white hover:shadow-brutal-xs"
            title="Pull from remote"
          >
            Pull
          </button>
          <button
            onClick={handlePush}
            className="cursor-pointer border-[2px] border-border/40 bg-white px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-text-light/60 transition-all duration-100 hover:border-border hover:bg-success hover:text-white hover:shadow-brutal-xs"
            title="Push to remote"
          >
            Push
          </button>
        </div>
      </div>

      {/* Push/pull status banner */}
      {pushPullStatus && (
        <div className="border-b-[2px] border-border/30 bg-accent-blue/10 px-3 py-1 font-mono text-[11px] text-accent-blue">
          {pushPullStatus}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between border-b-[2px] border-error/30 bg-error/10 px-3 py-1">
          <span className="font-mono text-[11px] text-error">{error}</span>
          <button
            onClick={clearError}
            className="cursor-pointer border-none bg-transparent font-mono text-xs font-bold text-error/50 hover:text-error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* ── Staged Changes ────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between border-b-[2px] border-border/20 bg-success/5 px-3 py-1">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-success">
              Staged ({stagedFiles.length})
            </span>
            {stagedFiles.length > 0 && (
              <button
                onClick={handleUnstageAll}
                className="cursor-pointer border-none bg-transparent font-display text-[9px] font-bold uppercase tracking-wider text-text-light/30 hover:text-text-light"
              >
                Unstage All
              </button>
            )}
          </div>
          {stagedFiles.length === 0 ? (
            <div className="px-3 py-2 font-body text-[11px] text-text-light/30">
              No staged changes
            </div>
          ) : (
            stagedFiles.map((file) => (
              <FileChangeRow
                key={`staged-${file.path}`}
                file={file}
                onToggle={handleToggleFile}
                onViewDiff={handleViewDiff}
              />
            ))
          )}
        </section>

        {/* ── Unstaged Changes ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between border-b-[2px] border-border/20 bg-error/5 px-3 py-1">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-text-light/60">
              Changes ({unstagedFiles.length})
            </span>
            {unstagedFiles.length > 0 && (
              <button
                onClick={handleStageAll}
                className="cursor-pointer border-none bg-transparent font-display text-[9px] font-bold uppercase tracking-wider text-text-light/30 hover:text-text-light"
              >
                Stage All
              </button>
            )}
          </div>
          {unstagedFiles.length === 0 ? (
            <div className="px-3 py-2 font-body text-[11px] text-text-light/30">
              Working tree clean
            </div>
          ) : (
            unstagedFiles.map((file) => (
              <FileChangeRow
                key={`unstaged-${file.path}`}
                file={file}
                onToggle={handleToggleFile}
                onViewDiff={handleViewDiff}
              />
            ))
          )}
        </section>

        {/* ── Commit Message ────────────────────────────────── */}
        <section className="border-t-[2px] border-border/30 px-3 py-2">
          <textarea
            ref={commitInputRef}
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Commit message..."
            rows={3}
            className="w-full resize-none border-[2px] border-border/30 bg-white p-2 font-mono text-[12px] text-text-light outline-none placeholder:text-text-light/30 focus:border-border focus:shadow-brutal-xs"
            data-testid="commit-message-input"
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || stagedFiles.length === 0}
            className={[
              "mt-1 w-full border-[2px] border-border px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-all duration-100",
              commitMessage.trim() && stagedFiles.length > 0
                ? "cursor-pointer bg-elf-gold text-text-light shadow-brutal-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                : "cursor-not-allowed bg-text-light/5 text-text-light/20",
            ].join(" ")}
            data-testid="commit-button"
          >
            Commit ({stagedFiles.length} file{stagedFiles.length !== 1 ? "s" : ""})
          </button>
          <p className="mt-1 text-center font-mono text-[9px] text-text-light/20">
            ⌘+Enter to commit
          </p>
        </section>

        {/* ── Diff Viewer ───────────────────────────────────── */}
        {diffText && (
          <section className="border-t-[2px] border-border/30">
            <DiffViewer diff={diffText} onClose={clearDiff} />
          </section>
        )}

        {/* ── Commit History ────────────────────────────────── */}
        <section className="border-t-[2px] border-border/30">
          <div className="border-b-[2px] border-border/20 px-3 py-1">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-text-light/50">
              History ({commits.length})
            </span>
          </div>
          {commits.length === 0 ? (
            <div className="px-3 py-3 font-body text-[11px] text-text-light/30">
              No commits yet
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {commits.map((commit) => (
                <div
                  key={commit.hash}
                  className="border-b border-border/5 px-3 py-1.5 hover:bg-elf-gold/5"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[10px] font-bold text-accent-blue">
                      {commit.shortHash}
                    </span>
                    <span className="min-w-0 truncate font-body text-[11px] text-text-light/80">
                      {commit.message}
                    </span>
                  </div>
                  <div className="flex gap-2 font-mono text-[9px] text-text-light/30">
                    <span>{commit.author}</span>
                    <span>{commit.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
