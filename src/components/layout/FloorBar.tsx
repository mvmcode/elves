/* FloorBar — tab bar at the bottom of main content, like Google Sheets sheet tabs.
 * Each tab represents a floor (workspace) with its own session lifecycle. */

import { useCallback, useMemo } from "react";
import { useSessionStore } from "@/stores/session";
import type { FloorSession } from "@/types/floor";

/** Status dot color based on session state. */
function getStatusColor(floor: FloorSession): string | null {
  if (!floor.session) return null;
  switch (floor.session.status) {
    case "active":
      return "#4D96FF";
    case "completed":
      return "#6BCB77";
    case "cancelled":
      return "#FF8B3D";
    default:
      return null;
  }
}

/** Truncate a label to maxLen characters. */
function truncateLabel(label: string, maxLen: number): string {
  return label.length > maxLen ? `${label.slice(0, maxLen)}\u2026` : label;
}

/**
 * Horizontal tab bar rendered at the bottom of the main content area.
 * Displays one tab per floor with status indicator, label, and close button.
 * "+" button creates a new floor. Active tab is highlighted with elf-gold.
 */
export function FloorBar(): React.JSX.Element {
  const floorsMap = useSessionStore((s) => s.floors);
  const activeFloorId = useSessionStore((s) => s.activeFloorId);
  const floors = useMemo(
    () => Object.values(floorsMap).sort((a, b) => a.order - b.order),
    [floorsMap],
  );
  const createFloor = useSessionStore((s) => s.createFloor);
  const closeFloor = useSessionStore((s) => s.closeFloor);
  const switchFloor = useSessionStore((s) => s.switchFloor);

  const handleCreateFloor = useCallback((): void => {
    createFloor();
  }, [createFloor]);

  const handleCloseFloor = useCallback(
    (event: React.MouseEvent, floorId: string): void => {
      event.stopPropagation();
      closeFloor(floorId);
    },
    [closeFloor],
  );

  return (
    <div
      className="flex h-10 shrink-0 items-center gap-0 overflow-x-auto border-t-[3px] border-border bg-white"
      data-testid="floor-bar"
    >
      {floors.map((floor) => {
        const isActive = floor.id === activeFloorId;
        const statusColor = getStatusColor(floor);
        const isRunning = floor.session?.status === "active";

        return (
          <button
            key={floor.id}
            onClick={() => switchFloor(floor.id)}
            className={[
              "group flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r-[3px] border-border px-3 font-display text-xs font-bold uppercase tracking-wider transition-colors duration-75",
              isActive
                ? "bg-elf-gold text-text-light"
                : "bg-white text-text-light/60 hover:bg-surface-light hover:text-text-light",
            ].join(" ")}
            data-testid="floor-tab"
            data-floor-id={floor.id}
            data-active={isActive}
          >
            {/* Status dot */}
            {statusColor && (
              <span
                className={[
                  "h-2 w-2 shrink-0 rounded-full",
                  isRunning ? "animate-pulse" : "",
                ].join(" ")}
                style={{ backgroundColor: statusColor }}
                data-testid="floor-status-dot"
              />
            )}

            {/* Tab label */}
            <span className="max-w-[120px] truncate">
              {truncateLabel(floor.label, 20)}
            </span>

            {/* Close button */}
            <span
              onClick={(event) => handleCloseFloor(event, floor.id)}
              className="ml-0.5 flex h-4 w-4 items-center justify-center text-[10px] opacity-40 transition-opacity hover:opacity-100"
              data-testid="floor-close-btn"
            >
              ×
            </span>
          </button>
        );
      })}

      {/* Add floor button */}
      <button
        onClick={handleCreateFloor}
        className="flex h-full shrink-0 cursor-pointer items-center px-3 border-none bg-transparent font-display text-sm font-bold text-text-light/40 transition-colors duration-75 hover:bg-surface-light hover:text-text-light"
        data-testid="floor-add-btn"
        title="New floor (Cmd+T)"
      >
        +
      </button>
    </div>
  );
}
