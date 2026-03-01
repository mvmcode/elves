/* WorkshopOverlay — React overlay rendered on top of the workshop canvas. Provides tooltip, elf detail panel, progress indicator, and view toggle hint. */

import { useCallback, useEffect, useMemo } from "react";
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

  // Auto-dismiss the speech bubble after 6 seconds
  useEffect(() => {
    if (!selectedElfId) return;
    const timer = setTimeout(() => setSelectedElfId(null), 6000);
    return () => clearTimeout(timer);
  }, [selectedElfId, setSelectedElfId]);

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

      {/* Elf speech bubble toast — pops up from bottom-center on elf click */}
      <AnimatePresence>
        {selectedElf && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-14 left-1/2 z-20 w-80 -translate-x-1/2 border-[3px] border-black bg-[#1A1A2E] shadow-[4px_4px_0_0_#000]"
            data-testid="workshop-detail-panel"
          >
            {/* Speech bubble pointer */}
            <div
              className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderBottom: "8px solid #000",
              }}
            />
            <div
              className="absolute -top-[5px] left-1/2 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: "6px solid #1A1A2E",
              }}
            />

            {/* Header — name, status, dismiss */}
            <div className="flex items-center justify-between border-b-[2px] border-black/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold tracking-wide text-[#FFD93D]">
                  {selectedElf.name}
                </h3>
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${statusDotColor(selectedElf)}`} />
                  <span className="font-mono text-[10px] font-bold text-[#FFFDF7]">
                    {elfStatusLabel(selectedElf)}
                  </span>
                </div>
              </div>
              <button
                onClick={dismissDetailPanel}
                className="cursor-pointer border-[2px] border-[#FFD93D] bg-transparent px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#FFD93D] transition-all duration-100 hover:bg-[#FFD93D] hover:text-black"
              >
                X
              </button>
            </div>

            {/* Quick stats row */}
            <div className="flex gap-3 border-b-[2px] border-black/30 px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="font-mono text-[8px] text-[#FFFDF7] opacity-50">Tools</span>
                <span className="font-mono text-xs font-bold text-[#4D96FF]">{toolsUsedCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[8px] text-[#FFFDF7] opacity-50">Files</span>
                <span className="font-mono text-xs font-bold text-[#6BCB77]">{filesChangedCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[8px] text-[#FFFDF7] opacity-50">Msgs</span>
                <span className="font-mono text-xs font-bold text-[#FFD93D]">{messagesSentCount}</span>
              </div>
            </div>

            {/* Last event snippet */}
            <div className="px-3 py-2">
              {selectedElfEvents.length === 0 ? (
                <p className="font-mono text-[10px] text-[#FFFDF7] opacity-30">
                  No events yet...
                </p>
              ) : (
                <div className="border-l-[2px] border-[#4D96FF]/30 pl-2">
                  <span className="font-mono text-[8px] text-[#4D96FF]">
                    {selectedElfEvents[selectedElfEvents.length - 1]!.type}
                  </span>
                  {selectedElfEvents[selectedElfEvents.length - 1]!.funnyStatus && (
                    <p className="font-mono text-[10px] text-[#FFFDF7] opacity-70">
                      {selectedElfEvents[selectedElfEvents.length - 1]!.funnyStatus}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* View Full Output button */}
            <div className="border-t-[2px] border-black/30 px-3 py-2">
              <button
                onClick={() => {
                  toggleViewMode();
                  dismissDetailPanel();
                }}
                className="w-full cursor-pointer border-[2px] border-black bg-[#4D96FF] px-3 py-1.5 font-mono text-[10px] font-bold text-white shadow-[3px_3px_0_0_#000] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
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
