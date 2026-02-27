/* ElfCard — neo-brutalist card showing a single elf's live state with personality. */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/shared/Badge";
import { ElfAvatar, getAvatarId } from "@/components/theater/ElfAvatar";
import { TerminalOutput } from "@/components/theater/TerminalOutput";
import type { Elf, ElfEvent, ElfStatus } from "@/types/elf";
import { getStatusMessage } from "@/lib/elf-names";

/** Display variant: "compact" (default card) or "terminal" (full-height rich output). */
export type ElfCardVariant = "compact" | "terminal";

interface ElfCardProps {
  readonly elf: Elf;
  readonly events?: readonly ElfEvent[];
  readonly isExpanded?: boolean;
  readonly onToggleExpand?: () => void;
  /** "compact" preserves current layout, "terminal" fills parent as rich terminal. */
  readonly variant?: ElfCardVariant;
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

/**
 * Neo-brutalist card displaying an elf's live state including avatar, name,
 * status badge, funny status message, progress bar, and expandable event output.
 *
 * Supports two variants:
 * - "compact" (default): traditional card with expand toggle for event list
 * - "terminal": full-height card filling parent, always showing rich TerminalOutput
 */
export function ElfCard({
  elf,
  events = [],
  isExpanded: controlledExpanded,
  onToggleExpand,
  variant = "compact",
}: ElfCardProps): React.JSX.Element {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;
  const isTerminal = variant === "terminal";

  const handleToggle = (): void => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const progress = estimateProgress(elf.status, events.length);
  const funnyStatus = getStatusMessage(elf.name, elf.status);

  /* Terminal variant: full-height flex column filling parent */
  if (isTerminal) {
    return (
      <div
        className="flex h-full flex-col border-[3px] border-border bg-white shadow-brutal-lg"
        style={{ borderLeftWidth: "4px", borderLeftColor: elf.color }}
        data-testid="elf-card"
      >
        {/* Compact header — all info on one line */}
        <div className="flex items-center gap-3 border-b-[2px] border-border px-4 py-2">
          <ElfAvatar
            avatarId={getAvatarId(elf.name)}
            status={elf.status}
            size="sm"
            color={elf.color}
          />
          <span className="font-display text-sm font-bold uppercase tracking-wide">
            {elf.name}
          </span>
          {elf.role && (
            <span className="font-body text-xs text-gray-500">{elf.role}</span>
          )}
          <Badge variant={statusBadgeVariant[elf.status]}>
            {statusLabel[elf.status]}
          </Badge>
          <span className="ml-auto font-body text-xs italic text-gray-500" data-testid="funny-status">
            &ldquo;{funnyStatus}&rdquo;
          </span>
          {/* Inline progress bar */}
          <div className="flex items-center gap-1" data-testid="progress-bar">
            <div className="h-2 w-24 border-[2px] border-border bg-gray-200">
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%`, backgroundColor: elf.color }}
              />
            </div>
            <span className="font-mono text-xs font-bold">{progress}%</span>
          </div>
          {/* Collapse toggle for terminal output */}
          <button
            onClick={() => setIsOutputCollapsed((prev) => !prev)}
            className="ml-2 cursor-pointer border-[2px] border-border bg-gray-100 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider text-gray-600 transition-all duration-100 hover:bg-gray-200"
            data-testid="output-collapse-toggle"
          >
            {isOutputCollapsed ? "Show Output" : "Hide Output"}
          </button>
        </div>

        {/* Terminal output — fills remaining space, collapsible */}
        {!isOutputCollapsed && (
          <TerminalOutput
            events={events as ElfEvent[]}
            variant="terminal"
            elfColor={elf.color}
          />
        )}
      </div>
    );
  }

  /* Compact variant: traditional card layout */
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

      {/* Expandable event output */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="mt-2 overflow-hidden border-[2px] border-border"
          >
            <TerminalOutput
              events={events as ElfEvent[]}
              variant="compact"
              elfColor={elf.color}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
