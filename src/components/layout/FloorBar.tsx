/* FloorBar — tab bar at the top of main content, styled like editor/browser tabs.
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
 * Horizontal tab bar rendered at the top of the main content area (below TaskBar).
 * Displays one tab per floor with status indicator, label, and close button.
 * "+" button creates a new floor. Active tab highlighted with bottom accent.
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
      className="flex h-9 shrink-0 items-end gap-0 overflow-x-auto border-b-[2px] border-border bg-[#f5f3ee]"
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
              "group flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r-[1px] border-border/30 px-3 font-display text-[11px] font-bold tracking-wide transition-colors duration-75",
              isActive
                ? "border-b-[2px] border-b-elf-gold bg-white text-text-light"
                : "bg-transparent text-text-light/50 hover:bg-white/60 hover:text-text-light",
            ].join(" ")}
            data-testid="floor-tab"
            data-floor-id={floor.id}
            data-active={isActive}
          >
            {/* Status dot */}
            {statusColor && (
              <span
                className={[
                  "h-1.5 w-1.5 shrink-0 rounded-full",
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
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-sm text-[10px] opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 hover:bg-border/20"
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
        className="flex h-full shrink-0 cursor-pointer items-center px-3 border-none bg-transparent font-display text-sm font-bold text-text-light/30 transition-colors duration-75 hover:text-text-light/60"
        data-testid="floor-add-btn"
        title="New floor (Cmd+T)"
      >
        +
      </button>
    </div>
  );
}
