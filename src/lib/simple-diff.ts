/* simple-diff — generates a unified diff string from two text strings, line-by-line.
 * Used by ContextEditor to show changes between the last-saved and current context. */

/**
 * Generate a unified diff from `original` to `modified`.
 * Produces standard unified diff format with `---`/`+++` headers,
 * hunk headers, and +/-/space-prefixed lines.
 *
 * @param original - The baseline text (what was last saved to disk).
 * @param modified - The current text (what is in the editor now).
 * @param filename - File name shown in the diff header.
 * @returns A unified diff string. Empty string if both inputs are identical.
 */
export function generateUnifiedDiff(original: string, modified: string, filename: string): string {
  if (original === modified) return "";

  const originalLines = original === "" ? [] : original.split("\n");
  const modifiedLines = modified === "" ? [] : modified.split("\n");

  /* Compute LCS-based edit script via a simple Myers-style diff on lines. */
  const edits = computeLineEdits(originalLines, modifiedLines);

  if (edits.length === 0) return "";

  /* Build unified diff output. */
  const header = `--- ${filename}\n+++ ${filename}`;
  const hunks = buildHunks(edits, originalLines, modifiedLines);

  return [header, ...hunks].join("\n");
}

/* ── Edit types ─────────────────────────────────────────────────── */

type EditKind = "context" | "addition" | "deletion";

interface LineEdit {
  readonly kind: EditKind;
  /** Index into original lines (for context and deletions). */
  readonly originalIndex: number | null;
  /** Index into modified lines (for context and additions). */
  readonly modifiedIndex: number | null;
}

/* ── LCS diff ───────────────────────────────────────────────────── */

/**
 * Compute the longest common subsequence of lines using a standard DP table,
 * then back-trace to produce an edit list.
 */
function computeLineEdits(original: readonly string[], modified: readonly string[]): LineEdit[] {
  const m = original.length;
  const n = modified.length;

  /* DP table: dp[i][j] = LCS length for original[0..i-1] and modified[0..j-1] */
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === modified[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  /* Back-trace to build edit list in forward order. */
  const edits: LineEdit[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === modified[j - 1]) {
      edits.unshift({ kind: "context", originalIndex: i - 1, modifiedIndex: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      edits.unshift({ kind: "addition", originalIndex: null, modifiedIndex: j - 1 });
      j--;
    } else {
      edits.unshift({ kind: "deletion", originalIndex: i - 1, modifiedIndex: null });
      i--;
    }
  }

  return edits;
}

/* ── Hunk building ──────────────────────────────────────────────── */

/** Number of context lines to include around each change. */
const CONTEXT_LINES = 3;

interface Hunk {
  readonly startOriginal: number;
  readonly startModified: number;
  readonly edits: LineEdit[];
}

/**
 * Group the edit list into hunks — contiguous regions of changes with surrounding context.
 * Adjacent changed regions within CONTEXT_LINES of each other are merged into one hunk.
 */
function groupIntoHunks(edits: LineEdit[]): Hunk[] {
  const hunks: Hunk[] = [];
  let hunkEdits: LineEdit[] = [];
  let lastChangeIdx = -1;
  let hunkStartIdx = 0;

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i]!;
    if (edit.kind !== "context") {
      if (hunkEdits.length === 0) {
        /* Start a new hunk: include up to CONTEXT_LINES of preceding context */
        hunkStartIdx = Math.max(0, i - CONTEXT_LINES);
        hunkEdits = edits.slice(hunkStartIdx, i);
      } else if (i - lastChangeIdx > CONTEXT_LINES * 2 + 1) {
        /* Gap is too large — flush current hunk and start a new one */
        hunkEdits.push(...edits.slice(lastChangeIdx + 1, Math.min(lastChangeIdx + 1 + CONTEXT_LINES, i)));
        hunks.push(buildHunk(hunkEdits));
        hunkEdits = [];
        hunkStartIdx = Math.max(0, i - CONTEXT_LINES);
        hunkEdits = edits.slice(hunkStartIdx, i);
      } else {
        /* Within same hunk — include intermediate context lines */
        hunkEdits.push(...edits.slice(lastChangeIdx + 1, i));
      }
      hunkEdits.push(edit);
      lastChangeIdx = i;
    }
  }

  if (hunkEdits.length > 0) {
    /* Include trailing context after last change */
    const trailingEnd = Math.min(lastChangeIdx + 1 + CONTEXT_LINES, edits.length);
    hunkEdits.push(...edits.slice(lastChangeIdx + 1, trailingEnd));
    hunks.push(buildHunk(hunkEdits));
  }

  return hunks;
}

/** Construct a Hunk from a slice of edits. */
function buildHunk(edits: LineEdit[]): Hunk {
  const firstOriginal = edits.find((e) => e.originalIndex !== null)?.originalIndex ?? 0;
  const firstModified = edits.find((e) => e.modifiedIndex !== null)?.modifiedIndex ?? 0;
  return { startOriginal: firstOriginal, startModified: firstModified, edits };
}

/** Format hunks into unified diff strings. */
function buildHunks(
  edits: LineEdit[],
  original: readonly string[],
  modified: readonly string[],
): string[] {
  const hunks = groupIntoHunks(edits);

  return hunks.map((hunk) => {
    const originalCount = hunk.edits.filter((e) => e.kind !== "addition").length;
    const modifiedCount = hunk.edits.filter((e) => e.kind !== "deletion").length;

    const header = `@@ -${hunk.startOriginal + 1},${originalCount} +${hunk.startModified + 1},${modifiedCount} @@`;
    const lines = hunk.edits.map((edit) => {
      if (edit.kind === "addition") return `+${modified[edit.modifiedIndex!]}`;
      if (edit.kind === "deletion") return `-${original[edit.originalIndex!]}`;
      return ` ${original[edit.originalIndex!]}`;
    });

    return [header, ...lines].join("\n");
  });
}
