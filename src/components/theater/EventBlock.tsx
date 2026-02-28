/* EventBlock — rich per-event rendering with distinct visuals for each event type. */

import { useState } from "react";
import type { ElfEvent, ElfEventType } from "@/types/elf";

/** Display variant controlling padding and truncation. */
export type EventBlockVariant = "compact" | "terminal";

interface EventBlockProps {
  readonly event: ElfEvent;
  readonly variant: EventBlockVariant;
  /** Optional accent color from the elf, used for generic event fallback. */
  readonly elfColor?: string;
}

/** Formats a unix timestamp to HH:MM:SS. */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Returns emoji prefix for compact display of minor event types. */
function eventEmoji(type: ElfEventType): string {
  switch (type) {
    case "spawn": return "🚀";
    case "chat": return "💬";
    case "task_update": return "📝";
    case "permission_request": return "🔒";
    case "file_change": return "📁";
    default: return "▪️";
  }
}

/** Returns the left border color class for each event type. */
function borderColor(type: ElfEventType): string {
  switch (type) {
    case "thinking": return "border-purple-500";
    case "tool_call": return "border-blue-500";
    case "tool_result": return "border-green-500";
    case "output": return "border-gray-400";
    case "error": return "border-red-500";
    default: return "border-gray-600";
  }
}

/** Whether an event type uses the full block rendering or compact single-line. */
function isMinorType(type: ElfEventType): boolean {
  return type === "spawn" || type === "chat" || type === "task_update"
    || type === "permission_request" || type === "file_change";
}

/**
 * Rich per-event rendering. Each event type gets distinct visual treatment:
 * - thinking: purple dashed border, italic, collapsible
 * - tool_call: blue border, tool name in pill badge
 * - tool_result: green border, code blocks in <pre>
 * - output: white mono text, final output highlighted green
 * - error: red border, bold red text
 * - spawn/chat/task_update: compact single-line with emoji
 */
export function EventBlock({
  event,
  variant,
  elfColor,
}: EventBlockProps): React.JSX.Element {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const payload = event.payload as Record<string, unknown>;
  const isTerminal = variant === "terminal";
  const paddingClass = isTerminal ? "px-3 py-2" : "px-2 py-1";
  const textLimit = isTerminal ? 500 : 120;

  /* Minor event types: compact single-line with emoji */
  if (isMinorType(event.type)) {
    const description = describeMinorEvent(event);
    return (
      <div className={`flex items-center gap-2 ${paddingClass} font-mono text-xs text-text-inset`} data-testid="event-block">
        <span className="shrink-0 text-text-muted-light">[{formatTime(event.timestamp)}]</span>
        <span className="shrink-0">{eventEmoji(event.type)}</span>
        <span className="truncate">{description}</span>
      </div>
    );
  }

  /* Thinking block: purple dashed border, collapsible */
  if (event.type === "thinking") {
    const text = String(payload.text ?? "thinking...");
    const isLong = text.length > 80;
    const displayText = isThinkingExpanded || !isLong ? text : `${text.slice(0, 80)}...`;

    return (
      <div
        className={`border-l-token-normal border-dashed ${borderColor("thinking")} ${paddingClass}`}
        data-testid="event-block"
        data-event-type="thinking"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-xs italic text-purple-400" style={{ whiteSpace: "pre-wrap" }}>
            {displayText.slice(0, textLimit)}
          </p>
          {isLong && (
            <button
              onClick={() => setIsThinkingExpanded((prev) => !prev)}
              className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-mono text-xs text-purple-300 hover:text-purple-100"
              data-testid="thinking-toggle"
            >
              {isThinkingExpanded ? "Hide" : "Show reasoning..."}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Tool call: blue border, tool name in pill, detail in gray mono */
  if (event.type === "tool_call") {
    const toolName = String(payload.tool ?? "tool");
    const input = payload.input as Record<string, unknown> | undefined;
    const detail = String(input?.file_path ?? input?.command ?? input?.pattern ?? input?.query ?? input?.url ?? "").slice(0, textLimit);

    return (
      <div
        className={`border-l-token-normal ${borderColor("tool_call")} ${paddingClass}`}
        data-testid="event-block"
        data-event-type="tool_call"
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-text-muted-light font-mono text-xs">[{formatTime(event.timestamp)}]</span>
          <span
            className="inline-block border-token-thin border-blue-500/50 bg-blue-500/20 px-2 py-0.5 font-mono text-xs font-bold text-blue-300"
            data-testid="tool-pill"
          >
            {toolName}
          </span>
          {detail && (
            <span className="truncate font-mono text-xs text-text-muted-light">{detail}</span>
          )}
        </div>
      </div>
    );
  }

  /* Tool result: green border, collapsible for long output */
  if (event.type === "tool_result") {
    const result = String(payload.result ?? "done");
    const isMultiline = result.includes("\n");
    const isLongResult = isMultiline || result.length > 80;
    const firstLine = result.split("\n")[0] ?? result;
    const collapsedSummary = firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;

    return (
      <div
        className={`border-l-token-normal ${borderColor("tool_result")} ${paddingClass}`}
        data-testid="event-block"
        data-event-type="tool_result"
      >
        {isLongResult ? (
          <div>
            <div className="flex items-start justify-between gap-2">
              {isResultExpanded ? (
                <pre className="overflow-x-auto font-mono text-xs text-green-400 whitespace-pre-wrap">{result.slice(0, textLimit)}</pre>
              ) : (
                <p className="font-mono text-xs text-green-400 truncate">{collapsedSummary}</p>
              )}
              <button
                onClick={() => setIsResultExpanded((prev) => !prev)}
                className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-mono text-xs text-green-300 hover:text-green-100"
                data-testid="result-toggle"
              >
                {isResultExpanded ? "Hide output" : "Show output"}
              </button>
            </div>
          </div>
        ) : (
          <p className="font-mono text-xs text-green-400 truncate">{result}</p>
        )}
      </div>
    );
  }

  /* Output: white mono text, final output gets green highlight + bold */
  if (event.type === "output") {
    const text = String(payload.text ?? "");
    const isFinal = Boolean(payload.isFinal);
    const displayText = text.slice(0, textLimit) || "output";

    return (
      <div
        className={`border-l-token-normal ${borderColor("output")} ${paddingClass}`}
        data-testid="event-block"
        data-event-type="output"
      >
        <p
          className={[
            "font-mono text-xs whitespace-pre-wrap",
            isFinal ? "font-bold text-green-400" : "text-gray-200",
          ].join(" ")}
        >
          {displayText}
        </p>
      </div>
    );
  }

  /* Error: red border, bold red text */
  if (event.type === "error") {
    const message = String(payload.message ?? "error occurred");
    return (
      <div
        className={`border-l-token-normal ${borderColor("error")} ${paddingClass}`}
        data-testid="event-block"
        data-event-type="error"
      >
        <p className="font-mono text-xs font-bold text-red-400">{message.slice(0, textLimit)}</p>
      </div>
    );
  }

  /* Fallback: generic event display */
  return (
    <div className={`${paddingClass} font-mono text-xs`} data-testid="event-block" data-event-type={event.type}>
      <span className="text-text-muted-light">[{formatTime(event.timestamp)}]</span>{" "}
      <span style={{ color: elfColor ?? "#FFD93D" }}>
        {event.type}: {JSON.stringify(payload).slice(0, textLimit)}
      </span>
    </div>
  );
}

/** Returns a compact description for minor event types. */
function describeMinorEvent(event: ElfEvent): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "spawn":
      return `${event.elfName} spawned${payload.role ? ` as ${String(payload.role)}` : ""}`;
    case "chat":
      return `${event.elfName}: ${String(payload.message ?? payload.text ?? "...")}`;
    case "task_update":
      return String(payload.message ?? payload.description ?? "task updated");
    case "permission_request":
      return `requesting permission: ${String(payload.tool ?? "")}`;
    case "file_change":
      return `changed ${String(payload.path ?? "file")}`;
    default:
      return event.type;
  }
}
