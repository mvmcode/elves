/* WorkspaceTabBar — neo-brutalist horizontal tab bar for switching between open workspace terminals. */

import { useWorkspaceStore } from "@/stores/workspace";

/**
 * Renders a tab for each open workspace plus a "+" button to return to the grid.
 * Active tab gets accent background with brutal shadow; inactive tabs are clickable surfaces.
 * Only renders when there are open tabs.
 */
export function WorkspaceTabBar(): React.JSX.Element | null {
  const openSlugs = useWorkspaceStore((s) => s.openWorkspaceSlugs);
  const activeSlug = useWorkspaceStore((s) => s.activeWorkspaceSlug);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const closeWorkspaceTab = useWorkspaceStore((s) => s.closeWorkspaceTab);

  if (openSlugs.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b-[2px] border-border/30 bg-surface-elevated px-4 py-1.5"
      data-testid="workspace-tab-bar"
    >
      {openSlugs.map((slug) => {
        const isActive = slug === activeSlug;
        const workspace = workspaces.find((w) => w.slug === slug);
        const statusColor =
          workspace?.status === "active"
            ? "bg-success"
            : workspace?.status === "idle"
              ? "bg-elf-gold"
              : "bg-text-muted";

        return (
          <button
            key={slug}
            onClick={() => setActiveWorkspace(slug)}
            className={[
              "group flex cursor-pointer items-center gap-1.5 border-[2px] border-border px-3 py-1 font-display text-[11px] font-bold uppercase tracking-wider transition-all duration-100",
              isActive
                ? "bg-elf-gold text-black shadow-[3px_3px_0px_0px_#000]"
                : "bg-surface-elevated text-text-muted shadow-brutal-xs hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
            ].join(" ")}
            data-testid={`workspace-tab-${slug}`}
          >
            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
            <span className="max-w-[120px] truncate">{slug}</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeWorkspaceTab(slug);
              }}
              className="ml-1 inline-flex h-4 w-4 items-center justify-center text-[10px] opacity-50 hover:opacity-100"
              role="button"
              aria-label={`Close ${slug} tab`}
            >
              &times;
            </span>
          </button>
        );
      })}

      {/* "+" button — show grid view */}
      <button
        onClick={() => setActiveWorkspace(null)}
        className={[
          "cursor-pointer border-[2px] border-border px-2.5 py-1 font-display text-sm font-bold transition-all duration-100",
          activeSlug === null
            ? "bg-elf-gold text-black shadow-[3px_3px_0px_0px_#000]"
            : "bg-surface-elevated text-text-muted shadow-brutal-xs hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
        ].join(" ")}
        data-testid="workspace-tab-grid"
        title="Show workspace grid"
      >
        +
      </button>
    </div>
  );
}
