/* RecentlyShipped — list of recently completed workspaces with elf, merge time, and memory count. */

import type { ShippedWorkspace } from "@/types/workspace";

interface RecentlyShippedProps {
  readonly items: readonly ShippedWorkspace[];
}

/** Formats a timestamp into a human-readable relative time string. */
function formatRelativeTime(timestamp: number): string {
  const deltaSeconds = Math.floor((Date.now() - timestamp) / 1000);
  if (deltaSeconds < 60) return "just now";
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}hr ago`;
  if (deltaSeconds < 604800) return `${Math.floor(deltaSeconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Displays a list of recently shipped (completed) workspaces.
 * Each row shows a check mark, slug, elf name, relative merge time, and memory count.
 */
export function RecentlyShipped({ items }: RecentlyShippedProps): React.JSX.Element {
  if (items.length === 0) {
    return <></>;
  }

  return (
    <div data-testid="recently-shipped">
      <h3 className="mb-3 border-b-[2px] border-border/30 pb-2 font-display text-xs font-bold uppercase tracking-wider text-text-muted">
        Recently Shipped
      </h3>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div
            key={`${item.slug}-${item.mergedAt}`}
            className="flex items-center gap-3 border-[2px] border-border/20 bg-white px-3 py-2 font-body text-sm"
          >
            <span className="shrink-0 font-mono text-sm text-success">&#10003;</span>
            <span className="font-bold">{item.slug}</span>
            <span className="text-text-muted">{item.elfName}</span>
            <span className="ml-auto font-mono text-xs text-text-muted">
              {formatRelativeTime(item.mergedAt)}
            </span>
            {item.memoriesExtracted > 0 && (
              <span className="border-[2px] border-border/30 bg-info/10 px-1.5 py-0.5 font-mono text-[10px] text-info">
                {item.memoriesExtracted} mem
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
