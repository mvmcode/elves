/* ResizeHandle — neo-brutalist drag handle for resizable panel borders. */

interface ResizeHandleProps {
  /** Mouse event handler from useResizable hook. */
  readonly onMouseDown: (event: React.MouseEvent) => void;
  /** Whether a drag is currently in progress. */
  readonly isDragging: boolean;
  /** Which edge of the parent panel this handle sits on. */
  readonly side: "left" | "right";
}

/**
 * 8px-wide drag handle overlaying a panel border. Transparent at rest (the existing
 * 3px border shows through), highlights on hover and drag with grip dots.
 */
export function ResizeHandle({
  onMouseDown,
  isDragging,
  side,
}: ResizeHandleProps): React.JSX.Element {
  const positionClass = side === "right"
    ? "right-0 translate-x-1/2"
    : "left-0 -translate-x-1/2";

  return (
    <div
      onMouseDown={onMouseDown}
      className={[
        "absolute top-0 bottom-0 z-20 w-2 cursor-col-resize",
        "flex items-center justify-center",
        "transition-colors duration-100",
        positionClass,
        isDragging ? "bg-elf-gold" : "hover:bg-elf-gold/40",
      ].join(" ")}
      data-testid="resize-handle"
    >
      {/* Grip dots — three 2px black squares stacked vertically */}
      <div className="flex flex-col gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
        style={{ opacity: isDragging ? 1 : undefined }}
      >
        <div className="h-0.5 w-0.5 bg-black" />
        <div className="h-0.5 w-0.5 bg-black" />
        <div className="h-0.5 w-0.5 bg-black" />
      </div>
    </div>
  );
}
