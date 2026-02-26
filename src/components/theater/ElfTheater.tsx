/* ElfTheater — responsive workshop grid with global progress bar, lead badge, and inter-elf chat bubbles. */

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ElfCard } from "./ElfCard";
import { Badge } from "@/components/shared/Badge";
import type { Elf, ElfEvent } from "@/types/elf";

interface ElfTheaterProps {
  readonly elves: readonly Elf[];
  readonly events: readonly ElfEvent[];
  readonly leadElfId?: string;
  readonly costEstimate?: number;
  readonly startedAt?: number;
}

/** A chat bubble message extracted from chat-type events. */
interface ChatBubble {
  readonly id: string;
  readonly senderName: string;
  readonly message: string;
  readonly timestamp: number;
}

/** Chat bubble auto-dismiss duration in milliseconds. */
const CHAT_BUBBLE_TTL = 4000;

/** Fun global status messages displayed randomly during execution. */
const GLOBAL_STATUS_MESSAGES: readonly string[] = [
  "The workshop is humming with activity...",
  "Elves are collaborating at lightning speed!",
  "Teamwork makes the dream work!",
  "The workshop smells like fresh code and cookies...",
  "Productivity levels: through the roof!",
  "Elves are typing furiously...",
  "The code forge is running hot!",
];

/**
 * Returns the responsive grid column class based on elf count.
 * 1 = centered, 2 = side by side, 3 = row of 3, 4-6 = 2 rows.
 */
function gridColumnsClass(count: number): string {
  if (count <= 1) return "grid-cols-1 max-w-md mx-auto";
  if (count === 2) return "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto";
  if (count === 3) return "grid-cols-1 md:grid-cols-3";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
}

/** Formats elapsed seconds into a human-readable time string (Xm Ys). */
function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

/** Formats a cost number as USD with 2 decimal places. */
function formatCost(cost: number): string {
  return `~$${cost.toFixed(2)}`;
}

/**
 * Responsive grid layout that renders an ElfCard for each active elf.
 * Supports lead agent crown badge, inter-elf chat bubbles with auto-dismiss,
 * a global progress top bar with elapsed time and cost, and fun status messages.
 */
export function ElfTheater({
  elves,
  events,
  leadElfId,
  costEstimate = 0,
  startedAt,
}: ElfTheaterProps): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [chatBubbles, setChatBubbles] = useState<readonly ChatBubble[]>([]);
  const [globalStatusIndex, setGlobalStatusIndex] = useState(0);

  /** Pre-compute events grouped by elfId for efficient lookup. */
  const eventsByElf = useMemo(() => {
    const grouped = new Map<string, ElfEvent[]>();
    for (const event of events) {
      const existing = grouped.get(event.elfId);
      if (existing) {
        existing.push(event);
      } else {
        grouped.set(event.elfId, [event]);
      }
    }
    return grouped;
  }, [events]);

  /** Elapsed time counter — ticks every second when session is active. */
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  /** Rotate global status message every 8 seconds. */
  useEffect(() => {
    if (elves.length === 0) return;
    const interval = setInterval(() => {
      setGlobalStatusIndex((prev) => (prev + 1) % GLOBAL_STATUS_MESSAGES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [elves.length]);

  /** Extract chat bubbles from events — filter for chat-type events. */
  useEffect(() => {
    const chatEvents = events.filter((event) => event.type === "chat");
    const newBubbles: ChatBubble[] = chatEvents
      .slice(-5) /* Keep only the last 5 chat messages */
      .map((event) => ({
        id: event.id,
        senderName: event.elfName,
        message: String((event.payload as Record<string, unknown>).message ?? "..."),
        timestamp: event.timestamp,
      }));
    setChatBubbles(newBubbles);
  }, [events]);

  /** Remove expired chat bubbles. */
  const dismissBubble = useCallback((bubbleId: string): void => {
    setChatBubbles((prev) => prev.filter((bubble) => bubble.id !== bubbleId));
  }, []);

  /** Auto-dismiss chat bubbles after TTL. */
  useEffect(() => {
    const timers = chatBubbles.map((bubble) => {
      const age = Date.now() - bubble.timestamp;
      const remaining = Math.max(0, CHAT_BUBBLE_TTL - age);
      return setTimeout(() => dismissBubble(bubble.id), remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [chatBubbles, dismissBubble]);

  if (elves.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8" data-testid="theater-empty">
        <p className="font-display text-2xl font-bold uppercase tracking-wide text-gray-300">
          No Elves Active
        </p>
        <p className="mt-2 font-body text-sm text-gray-400">
          Summon a task to call the elves.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="elf-theater">
      {/* Global progress top bar */}
      <div
        className="flex items-center justify-between border-[3px] border-border bg-white px-4 py-3 shadow-brutal"
        data-testid="progress-bar-global"
      >
        <div className="flex items-center gap-4">
          <Badge variant="info">
            {elves.length} {elves.length === 1 ? "elf" : "elves"} deployed
          </Badge>
          {startedAt && (
            <span className="font-mono text-sm font-bold" data-testid="elapsed-time">
              {formatElapsed(elapsedSeconds)} elapsed
            </span>
          )}
          {costEstimate > 0 && (
            <span className="font-mono text-sm text-gray-600" data-testid="cost-estimate">
              {formatCost(costEstimate)}
            </span>
          )}
        </div>
        <span
          className="font-body text-xs italic text-gray-500"
          data-testid="global-status"
        >
          {GLOBAL_STATUS_MESSAGES[globalStatusIndex]}
        </span>
      </div>

      {/* Session heading */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide" data-testid="theater-heading">
          Elf Workshop
        </h2>
        <span className="border-[2px] border-border bg-elf-gold px-3 py-1 font-body text-xs font-bold uppercase">
          {elves.length} {elves.length === 1 ? "Elf" : "Elves"}
        </span>
      </div>

      {/* Inter-elf chat bubbles */}
      <AnimatePresence>
        {chatBubbles.map((bubble) => (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-start gap-2 border-[2px] border-border bg-elf-gold-light px-3 py-2 shadow-brutal-sm"
            data-testid="chat-bubble"
          >
            <span className="font-display text-xs font-bold uppercase">
              {bubble.senderName}:
            </span>
            <span className="font-body text-xs text-gray-700">
              {bubble.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Elf grid */}
      <div className={`grid gap-4 ${gridColumnsClass(elves.length)}`} data-testid="elf-grid">
        {elves.map((elf) => (
          <div key={elf.id} className="relative">
            {/* Lead agent crown badge */}
            {leadElfId === elf.id && (
              <div
                className="absolute -left-2 -top-2 z-10 flex h-8 w-8 items-center justify-center border-[2px] border-border bg-elf-gold shadow-brutal-sm"
                style={{ borderRadius: "50%" }}
                title="Lead Agent"
                data-testid="lead-badge"
              >
                <span role="img" aria-label="Lead agent">
                  👑
                </span>
              </div>
            )}
            <ElfCard
              elf={elf}
              events={eventsByElf.get(elf.id) ?? []}
              isExpanded={expandedId === elf.id}
              onToggleExpand={() =>
                setExpandedId((prev) => (prev === elf.id ? null : elf.id))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
