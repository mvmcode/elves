/* MemoryCard — neo-brutalist card displaying a single memory entry with actions. */

import { useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/shared/Badge";
import { CATEGORY_STYLES } from "./categoryStyles";
import type { MemoryEntry } from "@/types/memory";

/** Character limit before content is truncated with a "Show more" toggle. */
const TRUNCATION_LIMIT = 150;

/** Relevance score threshold below which the fading warning appears. */
const FADING_THRESHOLD = 0.3;

interface MemoryCardProps {
  readonly memory: MemoryEntry;
  readonly onEdit: (memory: MemoryEntry) => void;
  readonly onPin: (memory: MemoryEntry) => void;
  readonly onDelete: (memory: MemoryEntry) => void;
}

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

/** Parse the tags JSON string into an array of tag strings. Returns empty array on failure. */
function parseTags(tags: string): readonly string[] {
  if (!tags || tags.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === "string" && t.length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Neo-brutalist card for a single memory entry.
 * Shows category badge, content (truncated if long), tags, source,
 * relevance bar, timestamp, fading warning, and action buttons.
 * Delete requires inline confirmation before firing the callback.
 */
export function MemoryCard({
  memory,
  onEdit,
  onPin,
  onDelete,
}: MemoryCardProps): React.JSX.Element {
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const categoryStyle = CATEGORY_STYLES[memory.category];
  const isPinned = memory.source === "pinned";
  const isFading = memory.relevanceScore < FADING_THRESHOLD;
  const isLongContent = memory.content.length > TRUNCATION_LIMIT;
  const tags = useMemo(() => parseTags(memory.tags), [memory.tags]);

  const displayedContent =
    isLongContent && !isExpanded
      ? memory.content.slice(0, TRUNCATION_LIMIT) + "..."
      : memory.content;

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
      className={[
        "border-token-normal border-border bg-surface-elevated rounded-token-md p-5 shadow-brutal",
        isFading ? "border-l-4 border-l-warning" : "",
      ].join(" ")}
      data-testid="memory-card"
    >
      {/* Top row — category badge + timestamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={categoryStyle.className} data-testid="memory-category">
            {categoryStyle.label}
          </Badge>
          {isFading && (
            <Badge variant="warning" data-testid="fading-warning">
              Fading
            </Badge>
          )}
        </div>
        <span
          className="font-mono text-xs text-text-muted-light"
          data-testid="memory-timestamp"
        >
          {formatRelativeTime(memory.createdAt)}
        </span>
      </div>

      {/* Content with truncation */}
      <p
        className="mt-3 font-body text-sm leading-relaxed text-text-light"
        data-testid="memory-content"
      >
        {displayedContent}
      </p>
      {isLongContent && (
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-1 cursor-pointer font-body text-xs font-bold text-info hover:underline"
          data-testid="content-toggle"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Tag badges */}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" data-testid="memory-tags">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-block border-token-thin border-border bg-surface-muted rounded-token-sm px-2 py-0.5 font-mono text-[11px] text-text-muted-light"
              data-testid="memory-tag"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Source label */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-body text-xs text-label text-text-muted-light">
          Source:
        </span>
        <span
          className="font-mono text-xs text-text-muted"
          data-testid="memory-source"
        >
          {formatSource(memory.source)}
        </span>
      </div>

      {/* Relevance score bar */}
      <div className="mt-3" data-testid="memory-relevance">
        <div className="flex items-center justify-between">
          <span className="font-body text-xs text-label text-text-muted-light">
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
                  filled ? "bg-accent" : "bg-surface-muted",
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
              className="cursor-pointer border-token-thin border-border bg-error rounded-token-sm px-3 py-1 font-body text-xs font-bold text-white transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px]"
              data-testid="delete-confirm-yes"
            >
              Yes
            </button>
            <button
              onClick={handleCancelDelete}
              className="cursor-pointer border-token-thin border-border bg-surface-elevated rounded-token-sm px-3 py-1 font-body text-xs font-bold text-text-light transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px]"
              data-testid="delete-confirm-no"
            >
              No
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(memory)}
              className="cursor-pointer border-token-thin border-border bg-surface-elevated rounded-token-sm px-3 py-1 font-body text-xs text-label text-text-light shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="memory-edit"
            >
              Edit
            </button>
            <button
              onClick={() => onPin(memory)}
              className={[
                "cursor-pointer border-token-thin border-border rounded-token-sm px-3 py-1 font-body text-xs text-label shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                isPinned ? "bg-accent text-accent-contrast" : "bg-surface-elevated text-text-light",
              ].join(" ")}
              data-testid="memory-pin"
            >
              {isPinned ? "\u2605 Pinned" : "\u2606 Pin"}
            </button>
            <button
              onClick={handleDelete}
              className="cursor-pointer border-token-thin border-border bg-surface-elevated rounded-token-sm px-3 py-1 font-body text-xs text-label text-error shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
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
