/* TerminalOutput — scrollable event output container replacing the max-h-48 box in ElfCard. */

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { EventBlock } from "./EventBlock";
import type { ElfEvent } from "@/types/elf";
import type { EventBlockVariant } from "./EventBlock";

/** Maximum events rendered before showing "Load earlier" button. */
const MAX_VISIBLE_EVENTS = 500;

interface TerminalOutputProps {
  readonly events: readonly ElfEvent[];
  /** "terminal" fills available space (flex-1), "compact" caps at max-h-64. */
  readonly variant: EventBlockVariant;
  /** Accent color for generic event rendering fallback. */
  readonly elfColor?: string;
}

/**
 * Scrollable output container with auto-scroll, event count, and overflow truncation.
 * Terminal mode: flex-1 (fills parent), no max-h.
 * Compact mode: max-h-64 (256px), overflow-y-auto.
 */
export function TerminalOutput({
  events,
  variant,
  elfColor,
}: TerminalOutputProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visibleEvents = useMemo(() => {
    if (showAll || events.length <= MAX_VISIBLE_EVENTS) return events;
    return events.slice(-MAX_VISIBLE_EVENTS);
  }, [events, showAll]);

  const hasOverflow = events.length > MAX_VISIBLE_EVENTS && !showAll;

  /** Auto-scroll to bottom on new events unless user scrolled up. */
  useEffect(() => {
    if (!userScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleEvents.length, userScrolled]);

  /** Detect manual scroll away from bottom. */
  const handleScroll = useCallback((): void => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setUserScrolled(!isAtBottom);
  }, []);

  /** Resume auto-scroll when mouse leaves. */
  const handleMouseLeave = useCallback((): void => {
    setUserScrolled(false);
  }, []);

  const containerClass = variant === "terminal"
    ? "flex flex-1 flex-col overflow-hidden"
    : "flex flex-col max-h-64 overflow-hidden";

  return (
    <div className={containerClass} data-testid="terminal-output">
      {/* Header strip */}
      <div className="flex items-center justify-between border-b-token-thin border-border-inset bg-surface-inset-alt px-3 py-1.5">
        <span className="font-mono text-xs font-bold text-text-muted-light">
          Live Output
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-text-muted-light" data-testid="event-count">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
          <button
            onClick={() => setUserScrolled((prev) => !prev)}
            className={[
              "cursor-pointer border-token-thin border-border-inset px-2 py-0.5",
              "font-mono text-xs font-bold transition-colors duration-100",
              userScrolled
                ? "bg-surface-inset-alt text-text-inset"
                : "bg-surface-inset text-text-muted-light",
            ].join(" ")}
            title={userScrolled ? "Resume auto-scroll" : "Auto-scroll active"}
            data-testid="autoscroll-toggle"
          >
            {userScrolled ? "Resume" : "Auto"}
          </button>
        </div>
      </div>

      {/* Scrollable event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseLeave={handleMouseLeave}
        className="flex-1 overflow-y-auto bg-surface-inset"
        data-testid="terminal-scroll"
      >
        {/* Overflow indicator */}
        {hasOverflow && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full cursor-pointer border-b-token-thin border-border-inset bg-surface-inset-alt px-3 py-2 text-center font-mono text-xs font-bold text-text-muted-light hover:bg-surface-inset hover:text-text-inset"
            data-testid="load-earlier"
          >
            Load {events.length - MAX_VISIBLE_EVENTS} earlier events
          </button>
        )}

        {visibleEvents.length === 0 ? (
          <p className="p-4 font-mono text-xs text-text-muted-light" data-testid="terminal-empty">
            No events yet...
          </p>
        ) : (
          visibleEvents.map((event) => (
            <EventBlock
              key={event.id}
              event={event}
              variant={variant}
              elfColor={elfColor}
            />
          ))
        )}
      </div>
    </div>
  );
}
