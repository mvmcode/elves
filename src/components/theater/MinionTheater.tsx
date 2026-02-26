/* MinionTheater — responsive grid container that renders MinionCards for the active session. */

import { useState, useMemo } from "react";
import { MinionCard } from "./MinionCard";
import type { Minion, MinionEvent } from "@/types/minion";

interface MinionTheaterProps {
  readonly minions: readonly Minion[];
  readonly events: readonly MinionEvent[];
}

/**
 * Returns the responsive grid column class based on minion count.
 * 1 minion = 1 column, 2-3 = 2 columns, 4-6 = 3 columns, 7+ = 3 columns.
 */
function gridColumnsClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 3) return "grid-cols-1 md:grid-cols-2";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
}

/**
 * Responsive grid layout that renders a MinionCard for each active minion.
 * Displays a session heading, minion count, and manages card expand state.
 * Shows an empty state when no minions are active.
 */
export function MinionTheater({
  minions,
  events,
}: MinionTheaterProps): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /** Pre-compute events grouped by minionId for efficient lookup. */
  const eventsByMinion = useMemo(() => {
    const grouped = new Map<string, MinionEvent[]>();
    for (const event of events) {
      const existing = grouped.get(event.minionId);
      if (existing) {
        existing.push(event);
      } else {
        grouped.set(event.minionId, [event]);
      }
    }
    return grouped;
  }, [events]);

  if (minions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8" data-testid="theater-empty">
        <p className="font-display text-2xl font-bold uppercase tracking-wide text-gray-300">
          No Minions Active
        </p>
        <p className="mt-2 font-body text-sm text-gray-400">
          Deploy a task to summon the minions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="minion-theater">
      {/* Session heading */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide" data-testid="theater-heading">
          Minion Theater
        </h2>
        <span className="border-[2px] border-border bg-minion-yellow px-3 py-1 font-body text-xs font-bold uppercase">
          {minions.length} {minions.length === 1 ? "Minion" : "Minions"}
        </span>
      </div>

      {/* Minion grid */}
      <div className={`grid gap-4 ${gridColumnsClass(minions.length)}`}>
        {minions.map((minion) => (
          <MinionCard
            key={minion.id}
            minion={minion}
            events={eventsByMinion.get(minion.id) ?? []}
            isExpanded={expandedId === minion.id}
            onToggleExpand={() =>
              setExpandedId((prev) => (prev === minion.id ? null : minion.id))
            }
          />
        ))}
      </div>
    </div>
  );
}
