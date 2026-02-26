/* ElfCard — neo-brutalist card showing a single elf's live state with personality. */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/shared/Badge";
import { ElfAvatar, getAvatarId } from "@/components/theater/ElfAvatar";
import type { Elf, ElfEvent, ElfStatus } from "@/types/elf";
import { getStatusMessage } from "@/lib/elf-names";

interface ElfCardProps {
  readonly elf: Elf;
  readonly events?: readonly ElfEvent[];
  readonly isExpanded?: boolean;
  readonly onToggleExpand?: () => void;
}

/** Maps elf status to Badge variant for consistent visual feedback. */
const statusBadgeVariant: Record<ElfStatus, "default" | "success" | "error" | "warning" | "info"> = {
  spawning: "info",
  working: "default",
  thinking: "info",
  waiting: "warning",
  chatting: "info",
  done: "success",
  error: "error",
  sleeping: "default",
};

/** Human-readable status label for the badge. */
const statusLabel: Record<ElfStatus, string> = {
  spawning: "Spawning",
  working: "Working",
  thinking: "Thinking",
  waiting: "Waiting",
  chatting: "Chatting",
  done: "Done",
  error: "Error",
  sleeping: "Sleeping",
};

/** Estimates a simple progress value (0-100) from elf status and event count. */
function estimateProgress(status: ElfStatus, eventCount: number): number {
  if (status === "done") return 100;
  if (status === "error") return 100;
  if (status === "spawning") return 5;
  /* Clamp event-based progress between 10 and 90 while working */
  return Math.min(90, Math.max(10, eventCount * 15));
}

/** Formats a unix timestamp to a short time string (HH:MM:SS). */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Neo-brutalist card displaying an elf's live state including avatar, name,
 * status badge, funny status message, progress bar, and expandable event output.
 * Uses framer-motion for entrance animation and expand/collapse transitions.
 */
export function ElfCard({
  elf,
  events = [],
  isExpanded: controlledExpanded,
  onToggleExpand,
}: ElfCardProps): React.JSX.Element {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleToggle = (): void => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const progress = estimateProgress(elf.status, events.length);
  const funnyStatus = getStatusMessage(elf.name, elf.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="border-[3px] border-border bg-white p-5 shadow-brutal-lg"
      style={{ borderLeftWidth: "4px", borderLeftColor: elf.color }}
      data-testid="elf-card"
    >
      {/* Header — avatar, name, status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ElfAvatar
            avatarId={getAvatarId(elf.name)}
            status={elf.status}
            size="md"
            color={elf.color}
          />
          <span className="font-display text-lg font-bold uppercase tracking-wide">
            {elf.name}
          </span>
        </div>
        <Badge variant={statusBadgeVariant[elf.status]}>
          {statusLabel[elf.status]}
        </Badge>
      </div>

      {/* Role */}
      {elf.role && (
        <p className="mt-1 font-body text-sm text-gray-600">
          Role: {elf.role}
        </p>
      )}

      {/* Funny status message */}
      <p className="mt-3 font-body text-sm italic text-gray-700" data-testid="funny-status">
        &ldquo;{funnyStatus}&rdquo;
      </p>

      {/* Progress bar — chunky segmented */}
      <div className="mt-4" data-testid="progress-bar">
        <div className="flex items-center justify-between">
          <div className="h-4 flex-1 border-[2px] border-border bg-gray-200">
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%`, backgroundColor: elf.color }}
            />
          </div>
          <span className="ml-2 font-mono text-xs font-bold">{progress}%</span>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={handleToggle}
        className="mt-3 flex w-full cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-body text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-text-light"
        data-testid="expand-toggle"
      >
        <span className="transition-transform duration-100" style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
          &#9654;
        </span>
        {isExpanded ? "Hide Output" : "Show Output"}
      </button>

      {/* Expandable event list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 max-h-48 overflow-y-auto border-[2px] border-border bg-gray-900 p-3"
              data-testid="event-list"
            >
              {events.length === 0 ? (
                <p className="font-mono text-xs text-gray-400">No events yet...</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="font-mono text-xs text-gray-300">
                    <span className="text-gray-500">[{formatTime(event.timestamp)}]</span>{" "}
                    <span className="font-bold" style={{ color: elf.color }}>
                      {event.type === "tool_call"
                        ? `Using ${(event.payload as Record<string, unknown>).tool ?? event.type}`
                        : event.type === "output"
                          ? String((event.payload as Record<string, unknown>).text ?? "Output")
                          : event.type.charAt(0).toUpperCase() + event.type.slice(1) + "..."}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
