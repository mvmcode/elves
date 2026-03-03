/* SessionComparison — side-by-side comparison of two sessions with metrics and event timelines. */

import { useState, useEffect, useCallback } from "react";
import { useUiStore } from "@/stores/ui";
import { useComparisonStore } from "@/stores/comparison";
import { useProjectStore } from "@/stores/project";
import { listSessions, listSessionEvents } from "@/lib/tauri";
import { EVENT_TYPE_COLOR, summarizeEventPayload } from "@/lib/event-summary";
import type { SessionEvent } from "@/lib/tauri";
import type { Session } from "@/types/session";
import type { ComparisonSession, ComparisonMetrics } from "@/types/comparison";

/** Runtime abbreviation badge. */
const RUNTIME_BADGE: Record<string, string> = {
  "claude-code": "CC",
  codex: "CX",
};

/** Derives ComparisonMetrics from a session and its events. */
function computeMetrics(cs: ComparisonSession): ComparisonMetrics {
  const { session, events } = cs;
  const duration = session.endedAt
    ? session.endedAt - session.startedAt
    : Date.now() - session.startedAt;
  const toolCallCount = events.filter(
    (e) => e.eventType === "tool_use" || e.eventType === "tool_call",
  ).length;
  const errorCount = events.filter((e) => e.eventType === "error").length;
  return {
    eventCount: events.length,
    tokenCount: session.tokensUsed,
    cost: session.costEstimate,
    duration,
    toolCallCount,
    errorCount,
  };
}

/** Format milliseconds to a compact string. */
function formatDurationMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/** Six metric definitions used in the metrics card grid. */
const METRIC_DEFS: Array<{
  label: string;
  metricKey: keyof ComparisonMetrics;
  format: (v: number) => string;
  /** Lower is better for cost/duration/errors; higher is better for eventCount/tokens/tools */
  lowerIsBetter: boolean;
}> = [
  { label: "Events", metricKey: "eventCount", format: (v) => v.toLocaleString(), lowerIsBetter: false },
  { label: "Tokens", metricKey: "tokenCount", format: (v) => v.toLocaleString(), lowerIsBetter: false },
  { label: "Cost", metricKey: "cost", format: (v) => `$${v.toFixed(4)}`, lowerIsBetter: true },
  { label: "Duration", metricKey: "duration", format: formatDurationMs, lowerIsBetter: true },
  { label: "Tool Calls", metricKey: "toolCallCount", format: (v) => v.toLocaleString(), lowerIsBetter: false },
  { label: "Errors", metricKey: "errorCount", format: (v) => v.toLocaleString(), lowerIsBetter: true },
];

/** Determines whether a metric value is "better" for highlighting. */
function isBetter(thisValue: number, otherValue: number, lowerIsBetter: boolean): boolean {
  if (thisValue === otherValue) return false;
  return lowerIsBetter ? thisValue < otherValue : thisValue > otherValue;
}

interface MetricsCardProps {
  readonly metrics: ComparisonMetrics;
  readonly otherMetrics: ComparisonMetrics | null;
}

/** 3x2 grid of session metrics with green highlights for better values. */
function MetricsCard({ metrics, otherMetrics }: MetricsCardProps): React.JSX.Element {
  return (
    <div className="border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_#000] p-3 mb-3">
      <p className="font-display text-xs font-bold uppercase tracking-wider text-black/50 mb-2">
        Metrics
      </p>
      <div className="grid grid-cols-3 gap-2">
        {METRIC_DEFS.map(({ label, metricKey, format, lowerIsBetter }) => {
          const value = metrics[metricKey];
          const other = otherMetrics?.[metricKey] ?? null;
          const better = other !== null && isBetter(value, other, lowerIsBetter);
          return (
            <div
              key={metricKey}
              className={[
                "border-[2px] border-black px-2 py-1.5 transition-colors",
                better ? "bg-[#6BCB77]" : "bg-surface-elevated",
              ].join(" ")}
            >
              <p className="font-mono text-[10px] text-black/50 uppercase">{label}</p>
              <p className="font-mono text-sm font-bold text-black">{format(value)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EventTimelineProps {
  readonly events: SessionEvent[];
}

/** Scrollable event timeline showing type badge + summary per event. */
function EventTimeline({ events }: EventTimelineProps): React.JSX.Element {
  if (events.length === 0) {
    return (
      <div className="border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_#000] p-3 flex-1 flex items-center justify-center">
        <p className="font-mono text-xs italic text-black/40">No events recorded.</p>
      </div>
    );
  }

  return (
    <div className="border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_#000] flex-1 overflow-hidden flex flex-col min-h-0">
      <div className="border-b-[2px] border-black px-3 py-2 shrink-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/50">
          Events ({events.length})
        </p>
      </div>
      <div className="overflow-y-auto flex-1">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-2 border-b border-black/10 px-3 py-2 last:border-b-0"
          >
            <span
              className="mt-0.5 shrink-0 border-[2px] border-black px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
              style={{ backgroundColor: EVENT_TYPE_COLOR[event.eventType] ?? "#EEE" }}
            >
              {event.eventType.replace(/_/g, " ")}
            </span>
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-black/70">
              {summarizeEventPayload(event.eventType, event.payload)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SessionColumnProps {
  readonly side: "left" | "right";
  readonly initial: ComparisonSession | null;
  readonly sessions: Session[];
  readonly otherMetrics: ComparisonMetrics | null;
  readonly onSessionChange: (cs: ComparisonSession) => void;
}

/** One column of the comparison view — picker + metrics + timeline. */
function SessionColumn({
  side,
  initial,
  sessions,
  otherMetrics,
  onSessionChange,
}: SessionColumnProps): React.JSX.Element {
  const [current, setCurrent] = useState<ComparisonSession | null>(initial);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = useCallback(
    async (sessionId: string): Promise<void> => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      setIsLoading(true);
      try {
        const events = await listSessionEvents(sessionId);
        const cs: ComparisonSession = { session, events };
        setCurrent(cs);
        onSessionChange(cs);
      } catch (error) {
        console.error("Failed to load session events:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [sessions, onSessionChange],
  );

  const metrics = current ? computeMetrics(current) : null;
  const runtimeLabel = current ? (RUNTIME_BADGE[current.session.runtime] ?? "??") : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-r-[3px] border-black last:border-r-0 p-4 gap-3">
      {/* Column header */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-black/50">
          {side === "left" ? "Session A" : "Session B"}
        </span>
        {runtimeLabel && (
          <span className="border-[2px] border-black px-1.5 py-0.5 font-mono text-[10px] font-bold bg-[#FFD93D]">
            {runtimeLabel}
          </span>
        )}
      </div>

      {/* Session picker */}
      <select
        className="border-[3px] border-black bg-white px-3 py-2 font-body text-sm font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_#FFD93D] shrink-0"
        value={current?.session.id ?? ""}
        onChange={(e) => void handleSelect(e.target.value)}
        disabled={isLoading}
      >
        <option value="">— Pick a session —</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.task.length > 60 ? `${s.task.slice(0, 60)}…` : s.task}
            {" "}
            [{RUNTIME_BADGE[s.runtime] ?? s.runtime}]
          </option>
        ))}
      </select>

      {isLoading && (
        <p className="font-mono text-xs text-black/40 shrink-0">Loading events...</p>
      )}

      {/* Metrics + timeline when a session is selected */}
      {current && metrics && !isLoading && (
        <>
          <MetricsCard metrics={metrics} otherMetrics={otherMetrics} />
          <EventTimeline events={current.events} />
        </>
      )}

      {!current && !isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-sm font-bold text-black/30">
            Select a session above
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Two-column session comparison view.
 * Each column has a session picker, a metrics card (with winner highlighting),
 * and a scrollable event timeline. Shows a cross-runtime banner when runtimes differ.
 */
export function SessionComparison(): React.JSX.Element {
  const setActiveView = useUiStore((state) => state.setActiveView);
  const { left: initialLeft, setLeft, setRight, clearComparison } = useComparisonStore();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [leftCs, setLeftCs] = useState<ComparisonSession | null>(initialLeft);
  const [rightCs, setRightCs] = useState<ComparisonSession | null>(null);

  /* Load all sessions for the active project on mount */
  useEffect(() => {
    if (!activeProjectId) return;
    listSessions(activeProjectId)
      .then(setSessions)
      .catch((error: unknown) => console.error("Failed to load sessions for comparison:", error));
  }, [activeProjectId]);

  const handleLeftChange = useCallback(
    (cs: ComparisonSession): void => {
      setLeftCs(cs);
      setLeft(cs);
    },
    [setLeft],
  );

  const handleRightChange = useCallback(
    (cs: ComparisonSession): void => {
      setRightCs(cs);
      setRight(cs);
    },
    [setRight],
  );

  const handleClose = useCallback((): void => {
    clearComparison();
    setActiveView("history");
  }, [clearComparison, setActiveView]);

  const leftMetrics = leftCs ? computeMetrics(leftCs) : null;
  const rightMetrics = rightCs ? computeMetrics(rightCs) : null;

  /* Show cross-runtime banner only when both sessions are selected and runtimes differ */
  const showCrossRuntime =
    leftCs !== null &&
    rightCs !== null &&
    leftCs.session.runtime !== rightCs.session.runtime;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-light">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-[3px] border-black px-4 py-3 bg-[#FFD93D] shrink-0">
        <h1 className="font-display text-xl font-black tracking-tight text-black uppercase">
          Session Comparison
        </h1>
        <button
          onClick={handleClose}
          className="border-[3px] border-black bg-white px-3 py-1 font-display text-xs font-bold uppercase shadow-[3px_3px_0px_0px_#000] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer"
        >
          ← Back to History
        </button>
      </div>

      {/* Cross-runtime banner */}
      {showCrossRuntime && (
        <div className="border-b-[3px] border-black bg-[#FF8B3D] px-4 py-2 text-center shrink-0">
          <p className="font-display text-sm font-bold text-black uppercase tracking-wide">
            ⚡ Cross-Runtime Comparison — {RUNTIME_BADGE[leftCs!.session.runtime] ?? leftCs!.session.runtime}
            {" vs "}
            {RUNTIME_BADGE[rightCs!.session.runtime] ?? rightCs!.session.runtime}
          </p>
        </div>
      )}

      {/* Two-column comparison area */}
      <div className="flex flex-1 overflow-hidden">
        <SessionColumn
          side="left"
          initial={initialLeft}
          sessions={sessions}
          otherMetrics={rightMetrics}
          onSessionChange={handleLeftChange}
        />
        <SessionColumn
          side="right"
          initial={null}
          sessions={sessions}
          otherMetrics={leftMetrics}
          onSessionChange={handleRightChange}
        />
      </div>
    </div>
  );
}
