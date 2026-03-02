/* WorkshopCanvas — React wrapper for the pixel-art workshop Canvas 2D scene. Manages the game loop, canvas sizing, and event bridging from Zustand to the scene engine. */

import { useRef, useEffect, useCallback } from "react";
import { WorkshopScene } from "./WorkshopScene";
import { useUiStore } from "@/stores/ui";
import type { ElfEvent, Elf } from "@/types/elf";
import type { WorkshopCallbacks } from "@/types/workshop";

/** Canvas dimensions based on the workshop tile grid. */
const TILE = 16;
const SCALE = 3;
const ST = TILE * SCALE;
const COLS = 28;
const ROWS = 18;
const CANVAS_WIDTH = COLS * ST;
const CANVAS_HEIGHT = ROWS * ST;

interface WorkshopCanvasProps {
  /** Elf instances from the session store. */
  readonly elves: readonly Elf[];
  /** Event stream from the session store. */
  readonly events: readonly ElfEvent[];
}

/**
 * Renders the animated pixel-art workshop scene inside a Canvas element.
 * Creates and owns a WorkshopScene instance, runs the game loop via
 * requestAnimationFrame, and bridges ElfEvents from the Zustand session
 * store into the scene engine.
 */
export function WorkshopCanvas({ elves, events }: WorkshopCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WorkshopScene | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const processedEventCountRef = useRef<number>(0);
  const knownElfIdsRef = useRef<Set<string>>(new Set());

  const toggleWorkshopViewMode = useUiStore((state) => state.toggleWorkshopViewMode);
  const setSelectedWorkshopElfId = useUiStore((state) => state.setSelectedWorkshopElfId);

  /** Callbacks from the scene engine to React state. */
  const callbacks: WorkshopCallbacks = {
    onElfClick: useCallback((elfId: string) => {
      setSelectedWorkshopElfId(elfId);
    }, [setSelectedWorkshopElfId]),
    onBenchClick: useCallback((_benchId: number) => {
      /* Bench click: could show bench detail — placeholder for now. */
    }, []),
    onNoticeClick: useCallback(() => {
      /* Notice board click: could open task graph — placeholder. */
    }, []),
    onCookieClick: useCallback(() => {
      /* Cookie jar click: could show progress — placeholder. */
    }, []),
    onDeliveryClick: useCallback(() => {
      /* Delivery chute click: could show artifacts — placeholder. */
    }, []),
    onCotsClick: useCallback(() => {
      /* Cots click: could show idle agents — placeholder. */
    }, []),
    onFireplaceClick: useCallback(() => {
      /* Fireplace click: ambient/cosmetic — placeholder. */
    }, []),
    onViewToggle: useCallback(() => {
      toggleWorkshopViewMode();
    }, [toggleWorkshopViewMode]),
  };

  /** Initialize the scene and start the game loop. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scene = new WorkshopScene(callbacks);
    sceneRef.current = scene;
    processedEventCountRef.current = 0;
    knownElfIdsRef.current = new Set();

    function gameLoop(time: number): void {
      const dt = lastTimeRef.current === 0 ? 16 : time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (sceneRef.current) {
        sceneRef.current.update(dt);
        sceneRef.current.render(ctx!);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      sceneRef.current = null;
      lastTimeRef.current = 0;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Sync elf spawns/removes with the scene.
   * On remount (e.g. switching back from card view), spawns elves via synthetic
   * spawn events so they get proper workbench assignment. Cancels the matrix
   * entrance animation since the elf was already visible before the switch. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const currentElfIds = new Set(elves.map((elf) => elf.id));
    const known = knownElfIdsRef.current;
    const isRemount = known.size === 0 && elves.length > 0;

    /* Spawn new elves via synthetic spawn event for full workbench assignment. */
    for (const elf of elves) {
      if (!known.has(elf.id)) {
        scene.processElfEvent({
          id: `resync-${elf.id}-${Date.now()}`,
          timestamp: Date.now(),
          elfId: elf.id,
          elfName: elf.name,
          runtime: elf.runtime,
          type: "spawn",
          payload: { hatColor: elf.color, accessory: "" },
        });

        /* On remount, skip the matrix entrance animation — the elf was
         * already visible before the view switch. Jump straight to idle. */
        if (isRemount) {
          const sprite = scene.getElf(elf.id);
          if (sprite) {
            sprite.matrixEffect = null;
            sprite.transitionTo("idle");
          }
        }

        known.add(elf.id);
      }
    }

    /* Remove elves that disappeared from the store. */
    for (const knownId of known) {
      if (!currentElfIds.has(knownId)) {
        scene.removeElf(knownId);
        known.delete(knownId);
      }
    }
  }, [elves]);

  /** Feed new ElfEvents into the scene as they arrive. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const newEvents = events.slice(processedEventCountRef.current);
    for (const event of newEvents) {
      scene.processElfEvent(event);
    }
    processedEventCountRef.current = events.length;
  }, [events]);

  /** Handle mouse and keyboard events. */
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sceneRef.current) return;
    sceneRef.current.handleMouseMove(event.nativeEvent, canvas);
  }, []);

  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sceneRef.current) return;
    sceneRef.current.handleClick(event.nativeEvent, canvas);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sceneRef.current) return;
    sceneRef.current.handleWheel(event.nativeEvent, canvas);
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sceneRef.current) return;
    sceneRef.current.handleMouseDown(event.nativeEvent, canvas);
  }, []);

  const handleMouseUp = useCallback(() => {
    sceneRef.current?.handleMouseUp();
  }, []);

  /** Global keyboard handler for view toggle and bench jumps. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      /* Only handle keys when not typing in an input/textarea. */
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      sceneRef.current?.handleKeyDown(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0a0a1a]">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          imageRendering: "pixelated",
        }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-testid="workshop-canvas"
      />
    </div>
  );
}
