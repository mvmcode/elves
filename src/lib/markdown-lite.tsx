/* markdown-lite — lightweight markdown renderer for output display.
 * Supports code blocks with syntax highlighting, inline code, bold, lists (unordered + ordered),
 * tables, blockquotes, horizontal rules, details/summary, and headers. No external dependencies. */

import React from "react";

interface MarkdownLiteProps {
  readonly text: string;
  readonly className?: string;
}

interface Segment {
  readonly type: "code" | "text";
  readonly content: string;
  readonly language: string;
}

/* ── Code Block Splitting ── */

/** Split text into code-fenced segments (with language tags) and text segments. */
function splitCodeBlocks(text: string): readonly Segment[] {
  const segments: Segment[] = [];
  const fence = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before.trim()) segments.push({ type: "text", content: before, language: "" });
    }
    segments.push({ type: "code", content: match[2]!, language: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    if (rest.trim()) segments.push({ type: "text", content: rest, language: "" });
  }

  return segments;
}

/* ── Syntax Highlighting ── */

/** Keyword sets per normalized language name. */
const KEYWORDS: Record<string, readonly string[]> = {
  typescript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "import", "export", "from", "type", "interface", "class", "new", "this",
    "async", "await", "throw", "try", "catch", "default", "switch", "case",
    "break", "continue", "typeof", "instanceof", "void", "null", "undefined",
    "true", "false", "extends", "implements", "readonly", "enum", "as",
  ],
  rust: [
    "pub", "fn", "struct", "enum", "impl", "trait", "use", "mod", "let", "mut",
    "const", "if", "else", "for", "while", "loop", "match", "return", "self",
    "Self", "super", "crate", "where", "async", "await", "move", "ref", "type",
    "true", "false", "as", "in", "dyn", "unsafe", "extern",
  ],
  json: ["true", "false", "null"],
  bash: [
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
    "esac", "function", "return", "exit", "echo", "export", "source", "cd",
    "mkdir", "rm", "cp", "mv", "grep", "sed", "awk", "cat", "sudo",
  ],
};

/** Normalize a code fence language tag to a canonical name for keyword lookup. */
function normalizeLang(lang: string): string | null {
  const lower = lang.toLowerCase();
  if (["ts", "tsx", "typescript", "js", "jsx", "javascript"].includes(lower)) return "typescript";
  if (["rust", "rs"].includes(lower)) return "rust";
  if (lower === "json") return "json";
  if (["bash", "sh", "shell", "zsh"].includes(lower)) return "bash";
  return null;
}

type TokenKind = "keyword" | "string" | "comment" | "number" | "plain";

/** CSS class per token kind — maps to the neo-brutalist color palette. */
const TOKEN_CLASS: Record<TokenKind, string> = {
  keyword: "text-info",       /* #4D96FF */
  string: "text-success",     /* #6BCB77 */
  comment: "text-gray-500",
  number: "text-warning",     /* #FF8B3D */
  plain: "",
};

/** Tokenize source code and return highlighted React nodes. Falls back to plain text for unknown languages. */
function highlightCode(code: string, lang: string): React.ReactNode {
  const normalized = normalizeLang(lang);
  if (!normalized) return code;

  const keywordList = KEYWORDS[normalized] ?? [];
  const regexParts: string[] = [];

  /* 1. Comments — highest priority so strings inside comments are not highlighted */
  if (normalized === "bash") {
    regexParts.push("(#.*)");
  } else {
    regexParts.push("(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/)");
  }

  /* 2. Strings */
  regexParts.push('("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')');

  /* 3. Numbers */
  regexParts.push("(\\b\\d+\\.?\\d*\\b)");

  /* 4. Keywords */
  if (keywordList.length > 0) {
    regexParts.push(`(\\b(?:${keywordList.join("|")})\\b)`);
  }

  const regex = new RegExp(regexParts.join("|"), "gm");
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(code)) !== null) {
    if (m.index > lastIdx) nodes.push(code.slice(lastIdx, m.index));

    let kind: TokenKind = "plain";
    if (m[1] !== undefined) kind = "comment";
    else if (m[2] !== undefined) kind = "string";
    else if (m[3] !== undefined) kind = "number";
    else if (m[4] !== undefined) kind = "keyword";

    const cls = TOKEN_CLASS[kind];
    nodes.push(cls ? <span key={m.index} className={cls}>{m[0]}</span> : m[0]);
    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < code.length) nodes.push(code.slice(lastIdx));
  return <>{nodes}</>;
}

/* ── Inline Rendering ── */

/** Render inline markdown tokens: bold (**text**) and inline code (`code`). */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    const token = match[0]!;
    if (token.startsWith("`")) {
      nodes.push(
        <code key={match.index} className="bg-surface-elevated px-1 py-0.5 font-mono text-xs text-info">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : [text];
}

/* ── Table Helpers ── */

/** Parse a pipe-delimited row into trimmed cell strings. */
function parseTableCells(row: string): string[] {
  return row.split("|").slice(1, -1).map((cell) => cell.trim());
}

/** Check if a row is a header separator (e.g., |---|---|). */
function isTableSeparator(row: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(row.trim());
}

/* ── Text Block Rendering ── */

/** Render a non-code text block with headers, lists, tables, blockquotes, hr, and details/summary. */
function renderTextBlock(text: string, blockIndex: number): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  /* Accumulators for multi-line constructs */
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];
  let blockquoteLines: string[] = [];
  let tableRows: string[] = [];

  /* Details/summary state machine */
  let inDetails = false;
  let detailsSummary = "";
  let detailsLines: string[] = [];

  /** Stable key prefix derived from current accumulator position. */
  const key = (prefix: string): string => `${prefix}-${blockIndex}-${nodes.length}`;

  function flushUnordered(): void {
    if (unorderedItems.length === 0) return;
    nodes.push(
      <ul key={key("ul")} className="my-1 list-disc pl-5">
        {unorderedItems.map((item, i) => (
          <li key={i} className="font-body text-xs">{renderInline(item)}</li>
        ))}
      </ul>,
    );
    unorderedItems = [];
  }

  function flushOrdered(): void {
    if (orderedItems.length === 0) return;
    nodes.push(
      <ol key={key("ol")} className="my-1 list-decimal pl-5">
        {orderedItems.map((item, i) => (
          <li key={i} className="font-body text-xs">{renderInline(item)}</li>
        ))}
      </ol>,
    );
    orderedItems = [];
  }

  function flushBlockquote(): void {
    if (blockquoteLines.length === 0) return;
    nodes.push(
      <blockquote key={key("bq")} className="my-2 border-l-[4px] border-accent bg-accent-light/30 py-1 pl-4 italic">
        {blockquoteLines.map((line, i) => (
          <p key={i} className="font-body text-xs">{renderInline(line)}</p>
        ))}
      </blockquote>,
    );
    blockquoteLines = [];
  }

  function flushTable(): void {
    if (tableRows.length === 0) return;
    if (tableRows.length < 2) {
      /* Not enough rows for a proper table — render as plain text */
      tableRows.forEach((row) => {
        nodes.push(<p key={key("p")} className="font-body text-xs">{renderInline(row)}</p>);
      });
      tableRows = [];
      return;
    }

    const headerRow = tableRows[0]!;
    const hasHeader = tableRows.length >= 2 && isTableSeparator(tableRows[1]!);
    const headers = hasHeader ? parseTableCells(headerRow) : [];
    const dataRows = hasHeader ? tableRows.slice(2) : tableRows;

    nodes.push(
      <div key={key("tbl")} className="my-2 overflow-x-auto">
        <table className="w-full border-collapse border-[2px] border-border font-body text-xs">
          {hasHeader && headers.length > 0 && (
            <thead>
              <tr className="bg-accent-light">
                {headers.map((cell, i) => (
                  <th key={i} className="border-[2px] border-border px-3 py-2 text-left font-bold">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {dataRows.map((row, rowIdx) => {
              const cells = parseTableCells(row);
              return (
                <tr key={rowIdx} className={rowIdx % 2 === 1 ? "bg-surface-elevated/50" : ""}>
                  {cells.map((cell, cellIdx) => (
                    <td key={cellIdx} className="border-[2px] border-border px-3 py-2">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>,
    );
    tableRows = [];
  }

  function flushAll(): void {
    flushUnordered();
    flushOrdered();
    flushBlockquote();
    flushTable();
  }

  for (const line of lines) {
    const trimmed = line.trim();

    /* ── Details/summary state machine ── */
    if (trimmed === "<details>" || trimmed.startsWith("<details>")) {
      flushAll();
      inDetails = true;
      detailsSummary = "";
      detailsLines = [];
      continue;
    }

    if (inDetails) {
      const summaryMatch = trimmed.match(/^<summary>(.*?)<\/summary>$/);
      if (summaryMatch) {
        detailsSummary = summaryMatch[1]!;
        continue;
      }
      if (trimmed === "</details>") {
        nodes.push(
          <details key={key("det")} className="my-2 border-[2px] border-border bg-surface-elevated">
            <summary className="cursor-pointer px-3 py-2 font-body text-xs font-bold hover:bg-accent-light">
              {detailsSummary || "Details"}
            </summary>
            <div className="border-t-[2px] border-border px-3 py-2 font-body text-xs">
              {detailsLines.map((dl, i) => (
                <p key={i}>{renderInline(dl)}</p>
              ))}
            </div>
          </details>,
        );
        inDetails = false;
        continue;
      }
      if (trimmed) detailsLines.push(trimmed);
      continue;
    }

    /* ── Table rows — lines starting and ending with | ── */
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushUnordered();
      flushOrdered();
      flushBlockquote();
      tableRows.push(trimmed);
      continue;
    }
    flushTable();

    /* ── Blockquotes ── */
    if (trimmed.startsWith("> ")) {
      flushUnordered();
      flushOrdered();
      blockquoteLines.push(trimmed.slice(2));
      continue;
    }
    flushBlockquote();

    /* ── Unordered list items ── */
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushOrdered();
      unorderedItems.push(trimmed.slice(2));
      continue;
    }

    /* ── Ordered list items ── */
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      flushUnordered();
      orderedItems.push(orderedMatch[2]!);
      continue;
    }

    /* Flush all accumulators before single-line constructs */
    flushAll();

    /* ── Horizontal rule ── */
    if (/^[-*_]{3,}$/.test(trimmed)) {
      nodes.push(<hr key={key("hr")} className="my-3 border-t-[2px] border-border" />);
      continue;
    }

    /* ── Headers (check longest prefix first) ── */
    if (trimmed.startsWith("### ")) {
      nodes.push(
        <h4 key={key("h3")} className="mt-2 mb-1 font-display text-sm font-bold">
          {renderInline(trimmed.slice(4))}
        </h4>,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      nodes.push(
        <h3 key={key("h2")} className="mt-2 mb-1 font-display text-base font-bold">
          {renderInline(trimmed.slice(3))}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      nodes.push(
        <h2 key={key("h1")} className="mt-2 mb-1 font-display text-lg font-bold">
          {renderInline(trimmed.slice(2))}
        </h2>,
      );
      continue;
    }

    /* ── Empty line — skip ── */
    if (!trimmed) continue;

    /* ── Regular paragraph ── */
    nodes.push(
      <p key={key("p")} className="font-body text-xs">
        {renderInline(trimmed)}
      </p>,
    );
  }

  flushAll();
  return nodes;
}

/* ── MarkdownLite Component ── */

/**
 * Lightweight markdown renderer supporting code blocks with syntax highlighting,
 * inline code, bold, ordered/unordered lists, tables, blockquotes, horizontal rules,
 * details/summary, and headers. No external dependencies — regex-based parsing.
 */
export function MarkdownLite({ text, className }: MarkdownLiteProps): React.JSX.Element {
  const segments = splitCodeBlocks(text);

  return (
    <div className={className}>
      {segments.map((segment, i) =>
        segment.type === "code" ? (
          <pre
            key={`code-${i}`}
            className="my-1 overflow-x-auto border-[2px] border-border bg-surface-elevated p-2 font-mono text-xs"
          >
            {highlightCode(segment.content, segment.language)}
          </pre>
        ) : (
          <React.Fragment key={`text-${i}`}>
            {renderTextBlock(segment.content, i)}
          </React.Fragment>
        ),
      )}
    </div>
  );
}
