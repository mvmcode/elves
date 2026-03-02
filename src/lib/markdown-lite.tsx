/* markdown-lite — lightweight markdown renderer for final output display.
 * Supports code blocks, inline code, bold, lists, and headers. No external dependencies. */

import React from "react";

interface MarkdownLiteProps {
  readonly text: string;
  readonly className?: string;
}

/** Split text into code-fenced segments and inline segments. */
function splitCodeBlocks(text: string): readonly { readonly code: boolean; readonly content: string }[] {
  const segments: { code: boolean; content: string }[] = [];
  const parts = text.split(/```(\w*)\n?/);

  let inCode = false;
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      /* First part is always text */
      if (parts[i]!.trim()) segments.push({ code: false, content: parts[i]! });
    } else if (!inCode) {
      /* This part is the language tag — skip it, next part is the code content */
      inCode = true;
    } else {
      /* This part is code content */
      segments.push({ code: true, content: parts[i]! });
      inCode = false;
    }
  }

  return segments;
}

/** Render inline markdown: bold, inline code. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  /* Match inline code or bold */
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    /* Text before the match */
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

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

  /* Remaining text after last match */
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/** Render a non-code text block with headers, lists, and inline formatting. */
function renderTextBlock(text: string, blockIndex: number): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList(): void {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`list-${blockIndex}-${nodes.length}`} className="my-1 list-disc pl-5">
        {listItems.map((item, i) => (
          <li key={i} className="font-body text-xs">{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    /* List items */
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    /* Flush any pending list before non-list content */
    flushList();

    /* Headers */
    if (trimmed.startsWith("### ")) {
      nodes.push(
        <h4 key={`h3-${blockIndex}-${nodes.length}`} className="mt-2 mb-1 font-display text-sm font-bold">
          {renderInline(trimmed.slice(4))}
        </h4>,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      nodes.push(
        <h3 key={`h2-${blockIndex}-${nodes.length}`} className="mt-2 mb-1 font-display text-base font-bold">
          {renderInline(trimmed.slice(3))}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      nodes.push(
        <h2 key={`h1-${blockIndex}-${nodes.length}`} className="mt-2 mb-1 font-display text-lg font-bold">
          {renderInline(trimmed.slice(2))}
        </h2>,
      );
      continue;
    }

    /* Empty line — skip */
    if (!trimmed) continue;

    /* Regular paragraph */
    nodes.push(
      <p key={`p-${blockIndex}-${nodes.length}`} className="font-body text-xs">
        {renderInline(trimmed)}
      </p>,
    );
  }

  flushList();
  return nodes;
}

/**
 * Lightweight markdown renderer supporting code blocks, inline code, bold, lists, and headers.
 * No external dependencies — regex-based parsing targeting ~80 lines of implementation.
 */
export function MarkdownLite({ text, className }: MarkdownLiteProps): React.JSX.Element {
  const segments = splitCodeBlocks(text);

  return (
    <div className={className}>
      {segments.map((segment, i) =>
        segment.code ? (
          <pre
            key={`code-${i}`}
            className="my-1 overflow-x-auto border-[2px] border-border bg-surface-elevated p-2 font-mono text-xs"
          >
            {segment.content}
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
