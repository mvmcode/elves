/* useResizable — pure mouse-event-based drag handler for resizable panel widths. */

import { useRef, useCallback, useState } from "react";

interface UseResizableOptions {
  /** Current width of the panel. */
  readonly initialWidth: number;
  /** Called with the new width during drag. */
  readonly onWidthChange: (width: number) => void;
  /** Minimum allowed width in pixels. */
  readonly minWidth: number;
  /** Maximum allowed width in pixels. */
  readonly maxWidth: number;
  /** Which edge of the panel is draggable: "left" drags decrease width leftward, "right" drags increase width rightward. */
  readonly side: "left" | "right";
}

interface UseResizableReturn {
  /** Props to spread onto the drag handle element. */
  readonly handleProps: { readonly onMouseDown: (event: React.MouseEvent) => void };
  /** Whether a drag is currently in progress. */
  readonly isDragging: boolean;
}

/**
 * Hook for resizable panels. Attaches document-level mousemove/mouseup listeners
 * on drag start, calculates delta from initial position, clamps to [min, max],
 * and calls onWidthChange. Uses requestAnimationFrame throttling to prevent jank.
 */
export function useResizable({
  initialWidth,
  onWidthChange,
  minWidth,
  maxWidth,
  side,
}: UseResizableOptions): UseResizableReturn {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback(
    (event: MouseEvent): void => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        const delta = event.clientX - startXRef.current;
        /* For "right" side: dragging right increases width. For "left" side: dragging left increases width. */
        const newWidth = side === "right"
          ? startWidthRef.current + delta
          : startWidthRef.current - delta;
        const clamped = Math.min(maxWidth, Math.max(minWidth, newWidth));
        onWidthChange(clamped);
        rafRef.current = null;
      });
    },
    [side, minWidth, maxWidth, onWidthChange],
  );

  const handleMouseUp = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    setIsDragging(false);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent): void => {
      event.preventDefault();
      startXRef.current = event.clientX;
      startWidthRef.current = initialWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      setIsDragging(true);
    },
    [initialWidth, handleMouseMove, handleMouseUp],
  );

  return {
    handleProps: { onMouseDown: handleMouseDown },
    isDragging,
  };
}
