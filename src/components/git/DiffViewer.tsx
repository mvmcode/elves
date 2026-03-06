/* DiffViewer — unified diff renderer with color-coded additions, deletions, and context. */

import { useMemo } from "react";

interface DiffViewerProps {
  /** Raw unified diff text from `git diff`. */
  readonly diff: string;
  /** Optional callback to close/clear the diff view. */
  readonly onClose?: () => void;
}

/** Classification of a diff line for rendering. */
type LineKind = "header" | "hunk" | "addition" | "deletion" | "context";

interface DiffLine {
  readonly kind: LineKind;
  readonly text: string;
  readonly lineNumber: number;
}

/** Parse a unified diff string into classified lines. */
function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let lineNumber = 0;

  for (const raw of diff.split("\n")) {
    lineNumber++;
    let kind: LineKind;

    if (raw.startsWith("diff ") || raw.startsWith("index ") || raw.startsWith("---") || raw.startsWith("+++")) {
      kind = "header";
    } else if (raw.startsWith("@@")) {
      kind = "hunk";
    } else if (raw.startsWith("+")) {
      kind = "addition";
    } else if (raw.startsWith("-")) {
      kind = "deletion";
    } else {
      kind = "context";
    }

    lines.push({ kind, text: raw, lineNumber });
  }

  return lines;
}

/** CSS classes for each line kind. */
const LINE_STYLES: Record<LineKind, string> = {
  header: "text-info font-bold",
  hunk: "text-accent-purple bg-accent-purple/10",
  addition: "text-success bg-success/10",
  deletion: "text-error bg-error/10",
  context: "text-text-light/60",
};

/**
 * Renders a unified diff with colored additions (green), deletions (red),
 * hunk headers (purple), and file headers (blue). Mono font, line numbers.
 */
export function DiffViewer({ diff, onClose }: DiffViewerProps): React.JSX.Element {
  const lines = useMemo(() => parseDiff(diff), [diff]);

  if (!diff.trim()) {
    return (
      <div className="flex items-center justify-center p-8 font-body text-sm text-text-light/40">
        No diff to display
      </div>
    );
  }

  return (
    <div className="flex flex-col border-[2px] border-border bg-[#1A1A2E]" data-testid="diff-viewer">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-[2px] border-border/50 bg-[#1A1A2E] px-3 py-1.5">
        <span className="font-display text-[10px] font-bold uppercase tracking-wider text-white/50">
          Diff
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent px-1 font-mono text-xs font-bold text-white/40 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto overflow-y-auto font-mono text-[12px] leading-[1.6]">
        {lines.map((line) => (
          <div
            key={line.lineNumber}
            className={`flex whitespace-pre ${LINE_STYLES[line.kind]}`}
          >
            <span className="inline-block w-10 shrink-0 select-none text-right text-white/20">
              {line.lineNumber}
            </span>
            <span className="px-2">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
