/* PlanViewer — enhanced viewer for plan and thinking content with approval controls.
 * Wraps MarkdownLite with auto-collapse for long content, plan mode approval buttons,
 * and inline editing. Neo-brutalist styling throughout. */

import { useState } from "react";
import { MarkdownLite } from "@/lib/markdown-lite";

interface PlanViewerProps {
  readonly text: string;
  readonly isThinking?: boolean;
  readonly permissionMode?: string;
  readonly onApprove?: () => void;
  readonly onReject?: () => void;
  readonly onEdit?: (editedText: string) => void;
}

/** Character threshold above which content is auto-collapsed with a toggle. */
const COLLAPSE_THRESHOLD = 500;

/**
 * Enhanced viewer for plan and thinking text.
 * Features:
 * - Auto-collapse for long content (>500 chars) with expand/collapse toggle
 * - Plan mode approval buttons (Approve / Reject / Edit) when permissionMode is "plan"
 * - Edit mode with textarea pre-filled with current content
 */
export function PlanViewer({
  text,
  isThinking = false,
  permissionMode,
  onApprove,
  onReject,
  onEdit,
}: PlanViewerProps): React.JSX.Element {
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const [isExpanded, setIsExpanded] = useState(!isLong);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);

  const showPlanButtons = permissionMode === "plan" && (onApprove ?? onReject ?? onEdit);
  const displayText = isExpanded ? text : `${text.slice(0, COLLAPSE_THRESHOLD)}...`;

  /* ── Edit mode ── */
  if (isEditing) {
    return (
      <div className="flex flex-col gap-2" data-testid="plan-viewer-edit">
        <textarea
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          className="min-h-[200px] w-full border-[2px] border-border bg-surface-elevated p-3 font-mono text-xs outline-none focus:shadow-[4px_4px_0px_0px_#FFD93D]"
          data-testid="plan-edit-textarea"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { onEdit?.(editValue); setIsEditing(false); }}
            className="border-[2px] border-border bg-accent px-4 py-2 font-display text-xs font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            data-testid="plan-edit-save"
          >
            Save
          </button>
          <button
            onClick={() => { setEditValue(text); setIsEditing(false); }}
            className="border-[2px] border-border bg-surface-elevated px-4 py-2 font-display text-xs font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            data-testid="plan-edit-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /* ── Read mode ── */
  return (
    <div
      className={[
        "p-3",
        isThinking
          ? "border-dashed border-purple-500/40 bg-purple-50/5"
          : "border-[2px] border-border bg-surface-elevated",
      ].join(" ")}
      data-testid="plan-viewer"
    >
      <MarkdownLite
        text={displayText}
        className={isThinking ? "italic text-purple-400" : ""}
      />

      {/* Expand/collapse toggle for long content */}
      {isLong && (
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-2 cursor-pointer border-none bg-transparent p-0 font-mono text-xs text-info hover:underline"
          data-testid="plan-viewer-toggle"
        >
          {isExpanded ? "Collapse" : "Show full reasoning"}
        </button>
      )}

      {/* Plan mode action buttons */}
      {showPlanButtons && (
        <div className="mt-3 flex gap-2 border-t-[2px] border-border/20 pt-3" data-testid="plan-viewer-actions">
          {onApprove && (
            <button
              onClick={onApprove}
              className="border-[2px] border-border bg-success px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="plan-approve"
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="border-[2px] border-border bg-error px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="plan-reject"
            >
              Reject
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="border-[2px] border-border bg-accent px-4 py-2 font-display text-xs font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="plan-edit"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
