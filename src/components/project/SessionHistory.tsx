/* SessionHistory — neo-brutalist list of past sessions for the active project. */

import { useState } from "react";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEmptyState } from "@/lib/funny-copy";
import type { Session, SessionStatus } from "@/types/session";

/** Maps session status to Badge variant. */
const STATUS_VARIANT: Record<SessionStatus, "default" | "success" | "error" | "warning" | "info"> = {
  active: "info",
  completed: "success",
  failed: "error",
  cancelled: "warning",
};

/** Maps session status to display label. */
const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Runtime icon for display. */
const RUNTIME_ICON: Record<string, string> = {
  "claude-code": "CC",
  codex: "CX",
};

/** Formats a duration in milliseconds to a human-readable string. */
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

/** Formats a unix timestamp to a date/time string. */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Lists all past sessions for the active project in a scrollable neo-brutalist card list.
 * Each card shows the task text, runtime icon, elf count, duration, and status.
 * Click to expand and see session summary.
 */
export function SessionHistory(): React.JSX.Element {
  const { sessions, isLoading } = useSessionHistory();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      <h2 className="mb-4 font-display text-2xl font-black uppercase tracking-tight">
        Session History
      </h2>

      {/* Session list */}
      <div className="space-y-3">
        {sessions.map((session: Session) => {
          const isExpanded = expandedId === session.id;
          return (
            <div
              key={session.id}
              className="border-[3px] border-border bg-white shadow-brutal-lg"
              data-testid="session-card"
            >
              {/* Card header — clickable to expand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent p-4 text-left"
                data-testid="session-card-header"
              >
                {/* Runtime icon */}
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center border-[2px] border-border font-mono text-xs font-black"
                  style={{
                    backgroundColor: session.runtime === "claude-code" ? "#A78BFA" : "#34D399",
                  }}
                >
                  {RUNTIME_ICON[session.runtime] ?? "??"}
                </span>

                {/* Task text */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm font-bold">{session.task}</p>
                  <p className="font-mono text-xs text-text-light/40">
                    {formatTimestamp(session.startedAt)} · {formatDuration(session.startedAt, session.endedAt)} · {session.agentCount} {session.agentCount === 1 ? "elf" : "elves"}
                  </p>
                </div>

                {/* Status badge */}
                <Badge variant={STATUS_VARIANT[session.status]}>
                  {STATUS_LABEL[session.status]}
                </Badge>

                {/* Expand indicator */}
                <span
                  className="text-sm transition-transform duration-100"
                  style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t-[2px] border-border/20 p-4" data-testid="session-detail">
                  {/* Summary */}
                  {session.summary ? (
                    <div className="mb-3">
                      <p className="mb-1 font-body text-xs font-bold uppercase tracking-wider text-text-light/50">Summary</p>
                      <p className="font-body text-sm">{session.summary}</p>
                    </div>
                  ) : (
                    <p className="mb-3 font-body text-sm italic text-text-light/40">
                      No summary recorded for this session.
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="mb-3 flex gap-4">
                    <div className="border-[2px] border-border/20 px-3 py-1">
                      <p className="font-mono text-xs text-text-light/50">Tokens</p>
                      <p className="font-mono text-sm font-bold">{session.tokensUsed.toLocaleString()}</p>
                    </div>
                    <div className="border-[2px] border-border/20 px-3 py-1">
                      <p className="font-mono text-xs text-text-light/50">Cost</p>
                      <p className="font-mono text-sm font-bold">${session.costEstimate.toFixed(4)}</p>
                    </div>
                  </div>

                  {/* Replay button (placeholder) */}
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => {
                      window.alert("Replay coming soon! This feature is under construction.");
                    }}
                  >
                    Replay Session
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
