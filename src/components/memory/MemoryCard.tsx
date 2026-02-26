/* MemoryCard — neo-brutalist card displaying a single memory entry with actions. */

import { useState, useCallback } from "react";
import { Badge } from "@/components/shared/Badge";
import type { MemoryEntry, MemoryCategory } from "@/types/memory";

interface MemoryCardProps {
  readonly memory: MemoryEntry;
  readonly onEdit: (memory: MemoryEntry) => void;
  readonly onPin: (memory: MemoryEntry) => void;
  readonly onDelete: (memory: MemoryEntry) => void;
}

/** Maps memory category to a Badge-compatible background color class. */
const CATEGORY_STYLES: Record<MemoryCategory, { className: string; label: string }> = {
  context: { className: "bg-info text-white", label: "Context" },
  decision: { className: "bg-elf-gold text-text-light", label: "Decision" },
  learning: { className: "bg-success text-white", label: "Learning" },
  preference: { className: "bg-[#C084FC] text-white", label: "Preference" },
  fact: { className: "bg-gray-400 text-white", label: "Fact" },
};

/** Formats a unix timestamp (seconds) as a relative time string. */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  /* Timestamps from SQLite are in seconds; JS uses milliseconds */
  const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const diffMs = now - timestampMs;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const date = new Date(timestampMs);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Formats the source field for display. */
function formatSource(source: string | null): string {
  if (!source) return "auto";
  if (source === "pinned") return "pinned";
  if (source === "manual") return "manual";
  /* Truncate long session IDs */
  if (source.length > 12) return `session:${source.slice(0, 8)}...`;
  return source;
}

/**
 * Neo-brutalist card for a single memory entry.
 * Shows category badge, content, source, relevance bar, timestamp, and action buttons.
 * Delete requires inline confirmation before firing the callback.
 */
export function MemoryCard({
  memory,
  onEdit,
  onPin,
  onDelete,
}: MemoryCardProps): React.JSX.Element {
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const categoryStyle = CATEGORY_STYLES[memory.category];
  const isPinned = memory.source === "pinned";

  const handleDelete = useCallback((): void => {
    setIsDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback((): void => {
    setIsDeleteConfirm(false);
    onDelete(memory);
  }, [onDelete, memory]);

  const handleCancelDelete = useCallback((): void => {
    setIsDeleteConfirm(false);
  }, []);

  return (
    <div
      className="border-[3px] border-border bg-white p-5 shadow-brutal"
      data-testid="memory-card"
    >
      {/* Top row — category badge + timestamp */}
      <div className="flex items-center justify-between">
        <Badge className={categoryStyle.className} data-testid="memory-category">
          {categoryStyle.label}
        </Badge>
        <span
          className="font-mono text-xs text-gray-500"
          data-testid="memory-timestamp"
        >
          {formatRelativeTime(memory.createdAt)}
        </span>
      </div>

      {/* Content */}
      <p
        className="mt-3 font-body text-sm leading-relaxed text-text-light"
        data-testid="memory-content"
      >
        {memory.content}
      </p>

      {/* Source label */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-body text-xs font-bold uppercase tracking-wider text-gray-500">
          Source:
        </span>
        <span
          className="font-mono text-xs text-gray-600"
          data-testid="memory-source"
        >
          {formatSource(memory.source)}
        </span>
      </div>

      {/* Relevance score bar */}
      <div className="mt-3" data-testid="memory-relevance">
        <div className="flex items-center justify-between">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-gray-500">
            Relevance
          </span>
          <span className="font-mono text-xs font-bold">
            {Math.round(memory.relevanceScore * 100)}%
          </span>
        </div>
        <div className="mt-1 flex h-3 gap-0.5">
          {Array.from({ length: 10 }, (_, index) => {
            const filled = index < Math.round(memory.relevanceScore * 10);
            return (
              <div
                key={index}
                className={[
                  "flex-1 border border-border",
                  filled ? "bg-elf-gold" : "bg-gray-200",
                ].join(" ")}
                data-testid="relevance-segment"
              />
            );
          })}
        </div>
      </div>

      {/* Actions row */}
      <div className="mt-4 flex items-center gap-2" data-testid="memory-actions">
        {isDeleteConfirm ? (
          <div className="flex items-center gap-2" data-testid="delete-confirm">
            <span className="font-body text-xs font-bold text-error">Are you sure?</span>
            <button
              onClick={handleConfirmDelete}
              className="cursor-pointer border-[2px] border-border bg-error px-3 py-1 font-body text-xs font-bold text-white transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px]"
              data-testid="delete-confirm-yes"
            >
              Yes
            </button>
            <button
              onClick={handleCancelDelete}
              className="cursor-pointer border-[2px] border-border bg-white px-3 py-1 font-body text-xs font-bold text-text-light transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px]"
              data-testid="delete-confirm-no"
            >
              No
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(memory)}
              className="cursor-pointer border-[2px] border-border bg-white px-3 py-1 font-body text-xs font-bold uppercase tracking-wider text-text-light shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="memory-edit"
            >
              Edit
            </button>
            <button
              onClick={() => onPin(memory)}
              className={[
                "cursor-pointer border-[2px] border-border px-3 py-1 font-body text-xs font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                isPinned ? "bg-elf-gold text-text-light" : "bg-white text-text-light",
              ].join(" ")}
              data-testid="memory-pin"
            >
              {isPinned ? "\u2605 Pinned" : "\u2606 Pin"}
            </button>
            <button
              onClick={handleDelete}
              className="cursor-pointer border-[2px] border-border bg-white px-3 py-1 font-body text-xs font-bold uppercase tracking-wider text-error shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="memory-delete"
            >
              X Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
