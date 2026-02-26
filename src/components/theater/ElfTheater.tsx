/* ElfTheater — responsive grid container that renders ElfCards for the active session. */

import { useState, useMemo } from "react";
import { ElfCard } from "./ElfCard";
import type { Elf, ElfEvent } from "@/types/elf";

interface ElfTheaterProps {
  readonly elves: readonly Elf[];
  readonly events: readonly ElfEvent[];
}

/**
 * Returns the responsive grid column class based on elf count.
 * 1 elf = 1 column, 2-3 = 2 columns, 4-6 = 3 columns, 7+ = 3 columns.
 */
function gridColumnsClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 3) return "grid-cols-1 md:grid-cols-2";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
}

/**
 * Responsive grid layout that renders an ElfCard for each active elf.
 * Displays a session heading, elf count, and manages card expand state.
 * Shows an empty state when no elves are active.
 */
export function ElfTheater({
  elves,
  events,
}: ElfTheaterProps): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      {/* Session heading */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide" data-testid="theater-heading">
          Elf Workshop
        </h2>
        <span className="border-[2px] border-border bg-elf-gold px-3 py-1 font-body text-xs font-bold uppercase">
          {elves.length} {elves.length === 1 ? "Elf" : "Elves"}
        </span>
      </div>

      {/* Elf grid */}
      <div className={`grid gap-4 ${gridColumnsClass(elves.length)}`}>
        {elves.map((elf) => (
          <ElfCard
            key={elf.id}
            elf={elf}
            events={eventsByElf.get(elf.id) ?? []}
            isExpanded={expandedId === elf.id}
            onToggleExpand={() =>
              setExpandedId((prev) => (prev === elf.id ? null : elf.id))
            }
          />
        ))}
      </div>
    </div>
  );
}
