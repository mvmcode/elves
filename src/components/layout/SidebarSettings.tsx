/* SidebarSettings — collapsible options panel at the bottom of the sidebar.
 * Wraps TaskBarPickers in vertical layout with expand/collapse toggle. */

import { useState } from "react";
import { useAppStore } from "@/stores/app";
import { TaskBarPickers } from "@/components/layout/TaskBarPickers";

/** Sliders/gear icon for the settings toggle. */
function IconSliders(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

/**
 * Collapsible settings panel for the sidebar bottom.
 * When collapsed, shows active selection badges. When expanded, shows full pickers.
 * In collapsed sidebar mode, shows just the icon with a tooltip.
 */
export function SidebarSettings({ isCollapsed }: { readonly isCollapsed: boolean }): React.JSX.Element {
  const [isExpanded, setExpanded] = useState(false);
  const selectedAgent = useAppStore((s) => s.selectedAgent);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const selectedApprovalMode = useAppStore((s) => s.selectedApprovalMode);
  const forceTeamMode = useAppStore((s) => s.forceTeamMode);
  const claudeDiscovery = useAppStore((s) => s.claudeDiscovery);
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);

  const hasOptions = defaultRuntime === "codex" || (claudeDiscovery !== null && claudeDiscovery.claudeDirExists);
  if (!hasOptions) return <></>;

  const hasActiveSelections = selectedAgent !== null || selectedModel !== null || selectedApprovalMode !== null || forceTeamMode;

  /* Collapsed sidebar — icon-only with tooltip */
  if (isCollapsed) {
    return (
      <div className="relative group flex justify-center">
        <button
          onClick={() => setExpanded(!isExpanded)}
          className={[
            "flex h-9 w-9 cursor-pointer items-center justify-center border-none bg-transparent transition-colors duration-100",
            hasActiveSelections ? "text-elf-gold" : "text-text-light/40 hover:text-text-light/70",
          ].join(" ")}
          title="Options"
        >
          <IconSliders />
        </button>
        {/* Tooltip */}
        <span className="pointer-events-none absolute left-[52px] z-50 hidden whitespace-nowrap border-[2px] border-border bg-surface-elevated px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-text-light shadow-brutal-sm group-hover:block">
          Options
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!isExpanded)}
        className={[
          "flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-1 py-1.5 transition-colors duration-100",
          hasActiveSelections ? "text-elf-gold" : "text-text-light/40 hover:text-text-light/70",
        ].join(" ")}
        data-testid="sidebar-settings-toggle"
      >
        <span className="shrink-0"><IconSliders /></span>
        <span className="font-display text-xs font-bold uppercase tracking-wider">Options</span>
        <span className="ml-auto text-[8px]">{isExpanded ? "\u25B2" : "\u25BC"}</span>
      </button>

      {/* Collapsed badges — show active selections inline */}
      {!isExpanded && hasActiveSelections && (
        <div className="flex flex-wrap gap-1 px-1 pb-1" data-testid="sidebar-settings-badges">
          {selectedAgent !== null && (
            <span className="border-token-thin border-border bg-info/20 px-2 py-0.5 font-mono text-[10px] font-bold rounded-token-sm">
              {selectedAgent.slug}
            </span>
          )}
          {selectedModel !== null && (
            <span className="border-token-thin border-border bg-accent/30 px-2 py-0.5 font-mono text-[10px] font-bold rounded-token-sm">
              {selectedModel}
            </span>
          )}
          {selectedApprovalMode !== null && (
            <span className="border-token-thin border-border bg-success/20 px-2 py-0.5 font-mono text-[10px] font-bold rounded-token-sm">
              {selectedApprovalMode}
            </span>
          )}
          {forceTeamMode && (
            <span className="border-token-thin border-border bg-[#E0C3FC]/30 px-2 py-0.5 font-mono text-[10px] font-bold rounded-token-sm">
              Team: ON
            </span>
          )}
        </div>
      )}

      {/* Expanded — full pickers in vertical layout */}
      {isExpanded && (
        <div className="pb-1 px-1" data-testid="sidebar-settings-pickers">
          <TaskBarPickers layout="vertical" />
        </div>
      )}
    </div>
  );
}
