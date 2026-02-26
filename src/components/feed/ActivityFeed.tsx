/* ActivityFeed — real-time scrolling feed of all MinionEvents in the active session. */

import { useState, useRef, useEffect, useCallback } from "react";
import type { MinionEvent, MinionEventType } from "@/types/minion";
import { getColor } from "@/lib/minion-names";

interface ActivityFeedProps {
  readonly events: readonly MinionEvent[];
  readonly maxHeight?: string;
}

/** Event filter categories for the filter bar. */
type FilterKey = "all" | "tools" | "chat" | "errors";

/** Maps filter keys to the event types they include. */
const FILTER_EVENT_TYPES: Record<FilterKey, readonly MinionEventType[] | null> = {
  all: null,
  tools: ["tool_call", "tool_result"],
  chat: ["chat", "output"],
  errors: ["error"],
};

/** Formats a unix timestamp to HH:MM:SS. */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Returns a human-readable description for an event based on its type. */
function describeEvent(event: MinionEvent): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "spawn":
      return `spawned${payload.role ? ` as ${String(payload.role)}` : ""}`;
    case "thinking":
      return "thinking...";
    case "tool_call":
      return String(payload.tool ?? "tool call");
    case "tool_result":
      return `result: ${String(payload.result ?? "").slice(0, 60)}`;
    case "output":
      return String(payload.text ?? "output");
    case "error":
      return String(payload.message ?? "error occurred");
    case "chat":
      return String(payload.text ?? "");
    case "task_update":
      return `task: ${String(payload.description ?? "updated")}`;
    case "permission_request":
      return `requesting permission: ${String(payload.tool ?? "")}`;
    case "file_change":
      return `changed ${String(payload.path ?? "file")}`;
    default:
      return event.type;
  }
}

/** Returns the emoji prefix for an event type. */
function eventEmoji(type: MinionEventType): string {
  switch (type) {
    case "spawn": return "🚀";
    case "thinking": return "💭";
    case "tool_call": return "🔧";
    case "tool_result": return "📋";
    case "output": return "✍️";
    case "error": return "❌";
    case "chat": return "💬";
    case "task_update": return "📝";
    case "permission_request": return "🔒";
    case "file_change": return "📁";
    default: return "▪️";
  }
}

/**
 * Real-time scrolling feed of MinionEvents. Features filter buttons for
 * event types, auto-scrolling that pauses when the user scrolls up,
 * expandable tool_call payloads, and per-minion color coding.
 */
export function ActivityFeed({
  events,
  maxHeight = "100%",
}: ActivityFeedProps): React.JSX.Element {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [expandedEventIds, setExpandedEventIds] = useState<ReadonlySet<string>>(new Set());
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredEvents = activeFilter === "all"
    ? events
    : events.filter((event) => FILTER_EVENT_TYPES[activeFilter]?.includes(event.type));

  /** Auto-scroll to bottom when new events arrive, unless user has scrolled up. */
  useEffect(() => {
    if (!userScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length, userScrolled]);

  /** Detect when user manually scrolls away from bottom. */
  const handleScroll = useCallback((): void => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setUserScrolled(!isAtBottom);
  }, []);

  /** Resume auto-scroll when user moves mouse out of the feed. */
  const handleMouseLeave = useCallback((): void => {
    setUserScrolled(false);
  }, []);

  /** Toggle expansion of a tool_call event to show its payload. */
  const toggleExpand = (eventId: string): void => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const filters: readonly { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "tools", label: "Tools" },
    { key: "chat", label: "Chat" },
    { key: "errors", label: "Errors" },
  ];

  return (
    <div
      className="flex flex-col border-[3px] border-border bg-gray-900"
      style={{ maxHeight }}
      data-testid="activity-feed"
    >
      {/* Header */}
      <div className="border-b-[2px] border-border bg-gray-800 px-4 py-2">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gray-300">
          Activity Feed
        </h3>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 border-b-[2px] border-gray-700 bg-gray-800 px-4 py-2" data-testid="filter-bar">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={[
              "cursor-pointer border-[2px] border-border px-3 py-1",
              "font-body text-xs font-bold uppercase tracking-wider",
              "transition-all duration-100",
              activeFilter === key
                ? "bg-minion-yellow text-text-light"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600",
            ].join(" ")}
            data-testid={`filter-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseLeave={handleMouseLeave}
        className="flex-1 overflow-y-auto p-2"
        data-testid="event-list"
      >
        {filteredEvents.length === 0 ? (
          <p className="p-4 text-center font-mono text-sm text-gray-500" data-testid="empty-state">
            {events.length === 0 ? "No events yet. Deploy minions to get started." : "No events match this filter."}
          </p>
        ) : (
          filteredEvents.map((event) => {
            const minionColor = getColor(event.minionName);
            const isToolCall = event.type === "tool_call";
            const isExpandable = isToolCall;
            const isEventExpanded = expandedEventIds.has(event.id);

            return (
              <div key={event.id} data-testid="event-row">
                <div
                  className="flex items-start gap-2 border-b border-gray-800 px-2 py-1.5"
                  style={{ borderLeftWidth: "4px", borderLeftColor: minionColor }}
                >
                  {/* Timestamp */}
                  <span className="shrink-0 font-mono text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>

                  {/* Emoji */}
                  <span className="shrink-0 text-sm">{eventEmoji(event.type)}</span>

                  {/* Content */}
                  <span className="flex-1 font-mono text-xs text-gray-300">
                    <span className="font-bold" style={{ color: minionColor }}>
                      {event.minionName}
                    </span>
                    {" "}
                    <span className={event.type === "error" ? "font-bold text-error" : ""}>
                      {describeEvent(event)}
                    </span>
                  </span>

                  {/* Expand button for tool calls */}
                  {isExpandable && (
                    <button
                      onClick={() => toggleExpand(event.id)}
                      className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-mono text-xs text-gray-500 hover:text-gray-300"
                      data-testid="expand-event"
                    >
                      {isEventExpanded ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {/* Expanded payload for tool calls */}
                {isEventExpanded && (
                  <div
                    className="border-b border-gray-800 bg-gray-950 px-6 py-2"
                    style={{ borderLeftWidth: "4px", borderLeftColor: minionColor }}
                    data-testid="event-payload"
                  >
                    <pre className="overflow-x-auto font-mono text-xs text-gray-400">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
