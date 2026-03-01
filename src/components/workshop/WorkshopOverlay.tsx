/* WorkshopOverlay — React overlay rendered on top of the workshop canvas. Provides tooltip, elf detail panel, progress indicator, and view toggle hint. */

import { useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUiStore } from "@/stores/ui";
import type { Elf, ElfEvent } from "@/types/elf";

interface WorkshopOverlayProps {
  /** All elf instances in the current session. */
  readonly elves: readonly Elf[];
  /** All events in the current session. */
  readonly events: readonly ElfEvent[];
  /** Session start timestamp for elapsed time calculation. */
  readonly startedAt?: number;
  /** Tasks done count for cookie jar display. */
  readonly tasksDone: number;
  /** Total tasks count. */
  readonly tasksTotal: number;
}

/** Formats elapsed seconds into Xm Ys. */
function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes === 0) return `${remaining}s`;
  return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
}

/**
 * Renders React-based UI overlays on top of the workshop canvas.
 * Includes: title overlay, status bar, elf detail panel, and view toggle hint.
 */
export function WorkshopOverlay({
  elves,
  events,
  startedAt,
  tasksDone,
  tasksTotal,
}: WorkshopOverlayProps): React.JSX.Element {
  const selectedElfId = useUiStore((state) => state.selectedWorkshopElfId);
  const setSelectedElfId = useUiStore((state) => state.setSelectedWorkshopElfId);
  const workshopViewMode = useUiStore((state) => state.workshopViewMode);
  const toggleViewMode = useUiStore((state) => state.toggleWorkshopViewMode);

  const selectedElf = useMemo(
    () => elves.find((elf) => elf.id === selectedElfId) ?? null,
    [elves, selectedElfId],
  );

  const selectedElfEvents = useMemo(() => {
    if (!selectedElfId) return [];
    return events.filter((event) => event.elfId === selectedElfId).slice(-20);
  }, [events, selectedElfId]);

  const dismissDetailPanel = useCallback(() => {
    setSelectedElfId(null);
  }, [setSelectedElfId]);

  /** Count tools used by selected elf from events. */
  const toolsUsedCount = useMemo(() => {
    if (!selectedElfId) return 0;
    return events.filter(
      (event) => event.elfId === selectedElfId && event.type === "tool_call",
    ).length;
  }, [events, selectedElfId]);

  /** Count file changes for selected elf. */
  const filesChangedCount = useMemo(() => {
    if (!selectedElfId) return 0;
    return events.filter(
      (event) => event.elfId === selectedElfId && event.type === "file_change",
    ).length;
  }, [events, selectedElfId]);

  /** Count chat messages sent by selected elf. */
  const messagesSentCount = useMemo(() => {
    if (!selectedElfId) return 0;
    return events.filter(
      (event) => event.elfId === selectedElfId && event.type === "chat",
    ).length;
  }, [events, selectedElfId]);

  /** Elapsed time since session start. */
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  /** Elf status label for the status bar. */
  function elfStatusLabel(elf: Elf): string {
    switch (elf.status) {
      case "working": return "typing";
      case "thinking": return "reading";
      case "waiting": return "waiting";
      case "sleeping": return "resting";
      case "chatting": return "chatting";
      case "done": return "done";
      case "error": return "error";
      default: return elf.status;
    }
  }

  /** Status dot color class based on elf status. */
  function statusDotColor(elf: Elf): string {
    switch (elf.status) {
      case "working": return "bg-[#6BCB77]";
      case "thinking": return "bg-[#FFD93D]";
      case "waiting": return "bg-[#4D96FF]";
      case "error": return "bg-[#FF6B6B]";
      case "sleeping": return "bg-[#808080]";
      default: return "bg-[#6BCB77]";
    }
  }

  return (
    <>
      {/* Title overlay — top-left */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <h1
          className="font-display text-2xl font-bold tracking-widest text-[#FFD93D]"
          style={{ textShadow: "3px 3px 0 #000" }}
        >
          ELVES WORKSHOP
        </h1>
        <p
          className="font-mono text-[8px] tracking-wider text-[#FFFDF7] opacity-60"
          style={{ textShadow: "1px 1px 0 #000" }}
        >
          {elves.length} ELVES DEPLOYED · {formatElapsed(elapsed)} ELAPSED
        </p>
      </div>

      {/* Status bar — bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-5 border-t-[3px] border-black bg-[#1A1A2E] px-4 py-2">
        {elves.map((elf) => (
          <div key={elf.id} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${statusDotColor(elf)}`} />
            <span className="font-mono text-[8px] text-[#FFFDF7]">
              {elf.name} — {elfStatusLabel(elf)}
            </span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-5 opacity-50">
          <span className="font-mono text-[8px] text-[#FFFDF7]">
            {tasksDone}/{tasksTotal} tasks done
          </span>
          <span className="font-mono text-[8px] text-[#FFFDF7]">
            [Space] {workshopViewMode === "workshop" ? "Card View" : "Workshop View"}
          </span>
        </div>
      </div>

      {/* Elf detail panel — slide out from right on elf click */}
      <AnimatePresence>
        {selectedElf && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l-[3px] border-black bg-[#1A1A2E]"
            data-testid="workshop-detail-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-[3px] border-black px-4 py-3">
              <div>
                <h3 className="font-display text-sm font-bold tracking-wide text-[#FFD93D]">
                  {selectedElf.name}
                </h3>
                <p className="font-mono text-[10px] text-[#FFFDF7] opacity-60">
                  {selectedElf.role ?? "Worker"} · {selectedElf.runtime}
                </p>
              </div>
              <button
                onClick={dismissDetailPanel}
                className="cursor-pointer border-[2px] border-[#FFD93D] bg-transparent px-2 py-0.5 font-mono text-xs font-bold text-[#FFD93D] transition-all duration-100 hover:bg-[#FFD93D] hover:text-black"
              >
                X
              </button>
            </div>

            {/* Status */}
            <div className="border-b-[2px] border-black/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${statusDotColor(selectedElf)}`} />
                <span className="font-mono text-xs font-bold text-[#FFFDF7]">
                  {elfStatusLabel(selectedElf)}
                </span>
              </div>
              {startedAt && (
                <p className="mt-1 font-mono text-[10px] text-[#FFFDF7] opacity-50">
                  Uptime: {formatElapsed(Math.floor((Date.now() - selectedElf.spawnedAt) / 1000))}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-3 border-b-[2px] border-black/30 px-4 py-3">
              <div className="border-[2px] border-black/30 px-2 py-1">
                <p className="font-mono text-[8px] text-[#FFFDF7] opacity-50">Tools</p>
                <p className="font-mono text-sm font-bold text-[#4D96FF]">{toolsUsedCount}</p>
              </div>
              <div className="border-[2px] border-black/30 px-2 py-1">
                <p className="font-mono text-[8px] text-[#FFFDF7] opacity-50">Files</p>
                <p className="font-mono text-sm font-bold text-[#6BCB77]">{filesChangedCount}</p>
              </div>
              <div className="border-[2px] border-black/30 px-2 py-1">
                <p className="font-mono text-[8px] text-[#FFFDF7] opacity-50">Messages</p>
                <p className="font-mono text-sm font-bold text-[#FFD93D]">{messagesSentCount}</p>
              </div>
            </div>

            {/* Recent output */}
            <div className="flex flex-1 flex-col overflow-hidden px-4 py-3">
              <h4 className="mb-2 font-mono text-[10px] font-bold tracking-wide text-[#FFFDF7] opacity-60">
                RECENT OUTPUT
              </h4>
              <div className="flex-1 overflow-y-auto">
                {selectedElfEvents.length === 0 ? (
                  <p className="font-mono text-[10px] text-[#FFFDF7] opacity-30">
                    No events yet...
                  </p>
                ) : (
                  selectedElfEvents.map((event) => (
                    <div
                      key={event.id}
                      className="mb-1 border-l-[2px] border-[#4D96FF]/30 pl-2"
                    >
                      <span className="font-mono text-[8px] text-[#4D96FF]">
                        {event.type}
                      </span>
                      {event.funnyStatus && (
                        <p className="font-mono text-[10px] text-[#FFFDF7] opacity-70">
                          {event.funnyStatus}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t-[2px] border-black/30 px-4 py-3">
              <button
                onClick={() => {
                  toggleViewMode();
                  dismissDetailPanel();
                }}
                className="flex-1 cursor-pointer border-[2px] border-black bg-[#4D96FF] px-3 py-1.5 font-mono text-[10px] font-bold text-white shadow-[3px_3px_0_0_#000] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                VIEW FULL OUTPUT
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
