/* ToolCallCard — enhanced tool call visualization with structured detail per tool type. */

import type { EventBlockVariant } from "./EventBlock";

interface ToolCallCardProps {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly timestamp: number;
  readonly variant: EventBlockVariant;
}

/** Formats a unix timestamp to HH:MM:SS. */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Extract a human-readable detail line from tool input based on tool type. */
function extractToolDetail(toolName: string, input: Record<string, unknown>): string {
  const lower = toolName.toLowerCase();

  /* File operations: show file_path */
  if (lower === "read" || lower === "write" || lower === "edit") {
    const filePath = String(input.file_path ?? "");
    if (filePath) {
      /* Truncate long paths — keep last 60 chars with leading ellipsis */
      return filePath.length > 60 ? `...${filePath.slice(-57)}` : filePath;
    }
  }

  /* Bash: show command */
  if (lower === "bash") {
    const command = String(input.command ?? "");
    return command.length > 80 ? `${command.slice(0, 77)}...` : command;
  }

  /* Search: show pattern + path */
  if (lower === "glob" || lower === "grep") {
    const pattern = String(input.pattern ?? "");
    const path = input.path ? ` in ${String(input.path)}` : "";
    const combined = `${pattern}${path}`;
    return combined.length > 80 ? `${combined.slice(0, 77)}...` : combined;
  }

  /* Web: show url or query */
  if (lower === "webfetch") {
    return String(input.url ?? "").slice(0, 80);
  }
  if (lower === "websearch") {
    return String(input.query ?? "").slice(0, 80);
  }

  /* LSP operations */
  if (lower === "lsp") {
    const op = String(input.operation ?? "");
    const filePath = String(input.filePath ?? "");
    return `${op} ${filePath}`.trim().slice(0, 80);
  }

  /* Default: first string value from input */
  for (const value of Object.values(input)) {
    if (typeof value === "string" && value.trim()) {
      return value.length > 80 ? `${value.slice(0, 77)}...` : value;
    }
  }

  return "";
}

/**
 * Enhanced tool call display with tool name pill badge and structured detail.
 * Shows file paths, commands, patterns, or URLs depending on the tool type.
 */
export function ToolCallCard({
  toolName,
  input,
  timestamp,
  variant,
}: ToolCallCardProps): React.JSX.Element {
  const paddingClass = variant === "terminal" ? "px-3 py-2" : "px-2 py-1";
  const detail = extractToolDetail(toolName, input);

  return (
    <div
      className={`border-l-token-normal border-blue-500 ${paddingClass}`}
      data-testid="event-block"
      data-event-type="tool_call"
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-xs text-text-muted-light">
          [{formatTime(timestamp)}]
        </span>
        <span
          className="inline-block border-token-thin border-blue-500/50 bg-blue-500/20 px-2 py-0.5 font-mono text-xs font-bold text-blue-300"
          data-testid="tool-pill"
        >
          {toolName}
        </span>
      </div>
      {detail && (
        <p className="mt-0.5 truncate pl-[calc(theme(spacing.2)+1px)] font-mono text-xs text-text-muted-light">
          {detail}
        </p>
      )}
    </div>
  );
}
