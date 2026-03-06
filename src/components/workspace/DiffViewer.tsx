/* DiffViewer — shows workspace diff summary with file-level insertions and deletions. */

import type { WorkspaceDiff } from "@/types/workspace";

interface DiffViewerProps {
  readonly diff: WorkspaceDiff | null;
  readonly workspaceSlug: string;
}

/** Maps diff file status to a display label. */
function statusLabel(status: "added" | "modified" | "deleted"): string {
  switch (status) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
  }
}

/** Maps diff file status to a badge color class. */
function statusColorClass(status: "added" | "modified" | "deleted"): string {
  switch (status) {
    case "added":
      return "bg-success text-white";
    case "modified":
      return "bg-info text-white";
    case "deleted":
      return "bg-error text-white";
  }
}

/**
 * Displays the diff for a workspace — a list of changed files with insertion/deletion
 * counts and a summary line. Shows an empty state when no diff data is available.
 */
export function DiffViewer({ diff, workspaceSlug }: DiffViewerProps): React.JSX.Element {
  if (!diff) {
    return (
      <div className="border-token-normal border-border bg-surface-elevated p-4 shadow-brutal-sm">
        <p className="font-body text-sm text-text-muted">
          No diff data for <span className="font-bold">{workspaceSlug}</span>. Load the diff to view changes.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-token-normal border-border bg-surface-elevated shadow-brutal-sm"
      data-testid={`diff-viewer-${workspaceSlug}`}
    >
      {/* Summary line */}
      <div className="border-b-[2px] border-border/30 px-4 py-3">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
          {diff.filesChanged} file{diff.filesChanged !== 1 ? "s" : ""} changed
        </span>
        <span className="ml-3 font-mono text-xs text-success">+{diff.insertions}</span>
        <span className="ml-2 font-mono text-xs text-error">-{diff.deletions}</span>
      </div>

      {/* File list */}
      <div className="flex flex-col">
        {diff.files.map((file) => (
          <div
            key={file.path}
            className="flex items-center gap-3 border-b border-border/10 px-4 py-2 last:border-b-0"
          >
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center border-[2px] border-border font-mono text-[10px] font-bold ${statusColorClass(file.status)}`}
            >
              {statusLabel(file.status)}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
            <span className="shrink-0 font-mono text-xs text-success">+{file.insertions}</span>
            <span className="shrink-0 font-mono text-xs text-error">-{file.deletions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
