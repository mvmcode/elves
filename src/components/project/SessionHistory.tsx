/* SessionHistory — compact table-like session list with inline expand and resume support. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useUiStore } from "@/stores/ui";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShareButton } from "@/components/project/ShareButton";
import { getEmptyState } from "@/lib/funny-copy";
import { listSessionEvents } from "@/lib/tauri";
import type { SessionEvent } from "@/lib/tauri";
import type { Session, SessionStatus } from "@/types/session";

/** Status dot color — 8px circle color-coded by session status. */
const STATUS_DOT_COLOR: Record<SessionStatus, string> = {
  active: "#4D96FF",
  completed: "#6BCB77",
  failed: "#FF6B6B",
  cancelled: "#FF8B3D",
};

/** Status tooltip text for accessibility. */
const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Runtime abbreviation for the compact badge. */
const RUNTIME_BADGE: Record<string, string> = {
  "claude-code": "CC",
  codex: "CX",
};

/** Event type to display color mapping. */
const EVENT_TYPE_COLOR: Record<string, string> = {
  thinking: "#4D96FF",
  tool_use: "#FF8B3D",
  tool_call: "#FF8B3D",
  tool_result: "#6BCB77",
  output: "#FFD93D",
  result: "#FFD93D",
  error: "#FF6B6B",
  spawn: "#E0C3FC",
  task_update: "#B8E6D0",
};

/** Summarize an event payload JSON string for display. */
function summarizeEventPayload(eventType: string, payloadStr: string): string {
  try {
    const payload = JSON.parse(payloadStr) as Record<string, unknown>;
    switch (eventType) {
      case "thinking":
        return typeof payload.text === "string" ? payload.text.slice(0, 150) : "Thinking...";
      case "tool_use":
      case "tool_call": {
        const tool = (payload.tool ?? payload.name ?? "unknown") as string;
        return `${tool}(...)`;
      }
      case "tool_result": {
        const output = (payload.output ?? payload.result ?? "") as string;
        return typeof output === "string" ? output.slice(0, 150) : JSON.stringify(output).slice(0, 150);
      }
      case "output":
      case "result":
        return typeof payload.text === "string" ? payload.text.slice(0, 150) :
               typeof payload.result === "string" ? (payload.result as string).slice(0, 150) :
               JSON.stringify(payload).slice(0, 150);
      case "error":
        return typeof payload.message === "string" ? payload.message : JSON.stringify(payload).slice(0, 150);
      default:
        return JSON.stringify(payload).slice(0, 150);
    }
  } catch {
    return payloadStr.slice(0, 150);
  }
}

/** Formats a duration in milliseconds to a compact human-readable string. */
function formatDuration(startedAt: number, endedAt: number | null): string {
  const end = endedAt ?? Date.now();
  const diffMs = end - startedAt;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/** Displays session events in a condensed feed when a session row is expanded. */
function SessionEventViewer({ sessionId }: { readonly sessionId: string }): React.JSX.Element {
  const [events, setEvents] = useState<readonly SessionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEvents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await listSessionEvents(sessionId);
      setEvents(result);
    } catch (error) {
      console.error("Failed to load session events:", error);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  if (isLoading) {
    return (
      <div className="border-token-thin border-border/20 p-3">
        <p className="font-mono text-xs text-text-light/40">Loading events...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="border-token-thin border-border/20 p-3">
        <p className="font-mono text-xs italic text-text-light/40">No events recorded.</p>
      </div>
    );
  }

  return (
    <div className="border-token-thin border-border/20" data-testid="session-events">
      <div className="border-b-token-thin border-border/20 px-3 py-2">
        <p className="font-body text-xs text-label text-text-light/50">
          Session Output ({events.length} events)
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2 border-b border-border/10 px-3 py-2 last:border-b-0">
            <span
              className="mt-0.5 shrink-0 border-token-thin border-border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
              style={{ backgroundColor: EVENT_TYPE_COLOR[event.eventType] ?? "#EEE" }}
            >
              {event.eventType.replace(/_/g, " ")}
            </span>
            <p className="min-w-0 flex-1 truncate font-mono text-xs">
              {summarizeEventPayload(event.eventType, event.payload)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact table-like session history. Each session renders as a dense ~36px row
 * with status dot, task text, runtime badge, duration, cost, and expand arrow.
 * Clicking a row expands it inline to show detail, events, and action buttons.
 */
export function SessionHistory(): React.JSX.Element {
  const { sessions, isLoading } = useSessionHistory();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const highlightedSessionId = useUiStore((state) => state.highlightedSessionId);
  const setHighlightedSessionId = useUiStore((state) => state.setHighlightedSessionId);
  const setTerminalSessionId = useUiStore((state) => state.setTerminalSessionId);
  const highlightRef = useRef<HTMLDivElement>(null);

  /** Auto-expand and scroll to the highlighted session (navigated from completion card). */
  useEffect(() => {
    if (!highlightedSessionId || isLoading || sessions.length === 0) return;
    const exists = sessions.some((s) => s.id === highlightedSessionId);
    if (exists) {
      setExpandedId(highlightedSessionId);
      setHighlightedSessionId(null);
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [highlightedSessionId, isLoading, sessions, setHighlightedSessionId]);

  /** Open the embedded terminal for a session with a Claude session ID. */
  const handleResume = useCallback(
    (sessionId: string): void => {
      setTerminalSessionId(sessionId);
    },
    [setTerminalSessionId],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="font-display text-xl font-bold text-text-light/40">Loading history...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    const empty = getEmptyState("no-sessions");
    return (
      <div data-testid="session-history-empty">
        <EmptyState message={`${empty.emoji} ${empty.title}`} submessage={empty.subtitle} />
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="session-history">
      {/* Header */}
      <h2 className="mb-4 font-display text-2xl text-heading tracking-tight">
        Session History
      </h2>

      {/* Session table container — brutalist chrome on the container, not individual rows */}
      <div className="border-token-normal border-border bg-surface-elevated rounded-token-md shadow-brutal-lg">
        {sessions.map((session: Session) => {
          const isExpanded = expandedId === session.id;
          const hasClaudeSession = session.claudeSessionId != null;
          return (
            <div
              key={session.id}
              ref={isExpanded ? highlightRef : undefined}
              data-testid="session-card"
            >
              {/* Compact row — ~36px, clickable to expand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                className={[
                  "flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left transition-colors duration-75",
                  "border-b-token-thin border-border/20",
                  isExpanded ? "bg-accent/10" : "hover:bg-surface-light",
                ].join(" ")}
                data-testid="session-card-header"
              >
                {/* Status dot */}
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_DOT_COLOR[session.status] }}
                  title={STATUS_LABEL[session.status]}
                  data-testid="status-dot"
                />

                {/* Task text — truncated, takes remaining space */}
                <span className="min-w-0 flex-1 truncate font-body text-sm font-bold">
                  {session.task}
                </span>

                {/* Runtime badge */}
                <span className="shrink-0 border-token-thin border-border px-1 py-0 font-mono text-[10px] font-bold">
                  {RUNTIME_BADGE[session.runtime] ?? "??"}
                </span>

                {/* Duration */}
                <span className="shrink-0 font-mono text-xs text-text-light/60">
                  {formatDuration(session.startedAt, session.endedAt)}
                </span>

                {/* Cost — only shown if > 0 */}
                {session.costEstimate > 0 && (
                  <span className="shrink-0 font-mono text-xs text-text-light/60">
                    ${session.costEstimate.toFixed(2)}
                  </span>
                )}

                {/* Expand arrow */}
                <span
                  className="shrink-0 text-xs transition-transform duration-100"
                  style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  &#9654;
                </span>
              </button>

              {/* Expanded inline detail */}
              {isExpanded && (
                <div className="border-b-token-thin border-border/20 bg-surface-elevated p-3" data-testid="session-detail">
                  {/* Summary */}
                  {session.summary ? (
                    <div className="mb-3">
                      <p className="mb-1 font-body text-xs text-label text-text-light/50">Summary</p>
                      <p className="font-body text-sm">{session.summary}</p>
                    </div>
                  ) : (
                    <p className="mb-3 font-body text-sm italic text-text-light/40">
                      No summary recorded for this session.
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="mb-3 flex gap-4">
                    <div className="border-token-thin border-border/20 px-3 py-1">
                      <p className="font-mono text-xs text-text-light/50">Tokens</p>
                      <p className="font-mono text-sm font-bold">{session.tokensUsed.toLocaleString()}</p>
                    </div>
                    <div className="border-token-thin border-border/20 px-3 py-1">
                      <p className="font-mono text-xs text-text-light/50">Cost</p>
                      <p className="font-mono text-sm font-bold">${session.costEstimate.toFixed(4)}</p>
                    </div>
                  </div>

                  {/* Session events */}
                  <div className="mb-3">
                    <SessionEventViewer sessionId={session.id} />
                  </div>

                  {/* Action buttons row */}
                  <div className="flex items-center gap-2">
                    <ShareButton sessionId={session.id} sessionTask={session.task} />
                    {hasClaudeSession && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleResume(session.id);
                        }}
                        className="cursor-pointer border-token-normal border-border bg-info/20 rounded-token-sm px-3 py-1 font-display text-xs text-label shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                        data-testid="resume-button"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
