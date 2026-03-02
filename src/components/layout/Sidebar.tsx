/* Sidebar — collapsible navigation bar with SVG icons and text labels.
 * Expanded by default (~180px) showing icon + label. Collapses to ~48px icon-only. */

import { useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { useUiStore } from "@/stores/ui";
import type { AppView } from "@/stores/ui";

/** SVG icon components for crisp rendering at any size. */
function IconWorkshop(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconFiles(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function IconMemory(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}

function IconSkills(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconMcp(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function IconHistory(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconSettings(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconCollapse(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </svg>
  );
}

function IconExpand(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  );
}

/** Navigation items with SVG icon components. */
const NAV_ITEMS: readonly { view: AppView; label: string; Icon: () => React.JSX.Element }[] = [
  { view: "session", label: "Workshop", Icon: IconWorkshop },
  { view: "files", label: "Files", Icon: IconFiles },
  { view: "memory", label: "Memory", Icon: IconMemory },
  { view: "skills", label: "Skills", Icon: IconSkills },
  { view: "mcp", label: "MCP Servers", Icon: IconMcp },
  { view: "history", label: "History", Icon: IconHistory },
  { view: "settings", label: "Settings", Icon: IconSettings },
];

/**
 * Collapsible sidebar — expanded (~180px) by default showing icon + label.
 * Click the chevron at the bottom to collapse to icon-only (~48px).
 */
export function Sidebar(): React.JSX.Element {
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setNewProjectDialogOpen = useUiStore((s) => s.setNewProjectDialogOpen);
  const isCollapsed = useUiStore((s) => s.isSidebarCollapsed);
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const removeProject = useProjectStore((s) => s.removeProject);

  const handleNavClick = useCallback(
    (view: AppView): void => {
      setActiveView(activeView === view && view !== "session" ? "session" : view);
    },
    [activeView, setActiveView],
  );

  return (
    <aside
      className={[
        "no-select flex h-full shrink-0 flex-col border-r-[3px] border-border bg-[#F0EDE6] transition-[width] duration-150",
        isCollapsed ? "w-[52px]" : "w-[180px]",
      ].join(" ")}
      data-testid="icon-sidebar"
    >
      {/* Logo — wordmark (includes elf icon) in expanded, elf icon only when collapsed */}
      <div className={[
        "flex shrink-0 items-center border-b-[2px] border-border",
        isCollapsed ? "h-11 justify-center" : "h-12 px-3",
      ].join(" ")}>
        {isCollapsed ? (
          <img
            src="/elves-icon.png"
            alt="ELVES"
            className="h-7 w-7"
            draggable={false}
          />
        ) : (
          <img
            src="/elves-wordmark.png"
            alt="ELVES"
            className="h-8"
            draggable={false}
          />
        )}
      </div>

      {/* Projects — right below logo */}
      {projects.length > 0 && (
        <div className={[
          "flex flex-col gap-1 border-b-[2px] border-border/40 py-2",
          isCollapsed ? "items-center" : "px-2",
        ].join(" ")}>
          {projects.slice(0, 5).map((project) => {
            const isActive = activeProjectId === project.id;
            return isCollapsed ? (
              <button
                key={project.id}
                onClick={() => setActiveProject(project.id)}
                className={[
                  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border-[2px] font-display text-[10px] font-black uppercase transition-all duration-100",
                  isActive
                    ? "border-border bg-elf-gold text-text-light shadow-brutal-xs"
                    : "border-transparent bg-transparent text-text-light/60 hover:border-border/40 hover:bg-white hover:text-text-light",
                ].join(" ")}
                title={project.name}
              >
                {project.name.charAt(0)}
              </button>
            ) : (
              <div
                key={project.id}
                className={[
                  "group flex w-full cursor-pointer items-center rounded-sm border-[2px] transition-all duration-100",
                  isActive
                    ? "border-border bg-elf-gold text-text-light shadow-brutal-xs"
                    : "border-transparent bg-transparent text-text-light/60 hover:border-border/40 hover:bg-white hover:text-text-light",
                ].join(" ")}
              >
                <button
                  onClick={() => setActiveProject(project.id)}
                  className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent px-2 py-1.5 text-left font-body text-xs font-bold text-inherit"
                  title={project.name}
                >
                  {project.name}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeProject(project.id);
                  }}
                  className="mr-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[10px] text-text-light/0 transition-colors group-hover:text-text-light/40 hover:!text-error"
                  title="Delete project"
                  data-testid="delete-project"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Nav items */}
      <div className={[
        "flex flex-1 flex-col gap-0.5 py-2",
        isCollapsed ? "items-center" : "px-2",
      ].join(" ")}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={[
                "group relative flex cursor-pointer items-center border-none transition-all duration-100",
                isCollapsed
                  ? "h-9 w-9 justify-center bg-transparent"
                  : "w-full gap-2.5 rounded-sm bg-transparent px-2 py-1.5",
                isActive
                  ? "text-text-light"
                  : "text-text-light/40 hover:text-text-light/70",
              ].join(" ")}
              title={isCollapsed ? item.label : undefined}
              data-testid={`nav-${item.view}`}
            >
              {/* Active indicator — left accent bar */}
              {isActive && (
                <span className={[
                  "absolute left-0 w-[3px] bg-elf-gold",
                  isCollapsed ? "top-0.5 h-8" : "top-0 h-full rounded-r-sm",
                ].join(" ")} />
              )}

              {/* Icon */}
              <span className="shrink-0"><item.Icon /></span>

              {/* Label — only in expanded mode */}
              {!isCollapsed && (
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  {item.label}
                </span>
              )}

              {/* Tooltip — only in collapsed mode */}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-[52px] z-50 hidden whitespace-nowrap border-[2px] border-border bg-white px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-text-light shadow-brutal-sm group-hover:block">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom: new project + collapse toggle */}
      <div className={[
        "flex flex-col gap-1 border-t-[2px] border-border/40 py-2",
        isCollapsed ? "items-center" : "px-2",
      ].join(" ")}>
        {/* New project button */}
        <button
          onClick={() => setNewProjectDialogOpen(true)}
          className={[
            "flex cursor-pointer items-center gap-2 border-[2px] border-border/40 bg-white font-display text-text-light/50 transition-all duration-100 hover:border-border hover:bg-elf-gold hover:text-text-light hover:shadow-brutal-xs",
            isCollapsed
              ? "h-8 w-8 justify-center text-base font-bold"
              : "w-full rounded-sm px-2 py-1.5 text-xs font-bold uppercase tracking-wider",
          ].join(" ")}
          title="New Project (Cmd+N)"
          data-testid="new-project-icon"
        >
          <span className="text-base leading-none">+</span>
          {!isCollapsed && <span>New Project</span>}
        </button>

        {/* Collapse/expand toggle */}
        <button
          onClick={toggleCollapsed}
          className={[
            "flex cursor-pointer items-center gap-2 border-none bg-transparent text-text-light/30 transition-colors duration-100 hover:text-text-light/60",
            isCollapsed
              ? "h-8 w-8 justify-center"
              : "w-full rounded-sm px-2 py-1",
          ].join(" ")}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="sidebar-toggle"
        >
          {isCollapsed ? <IconExpand /> : <IconCollapse />}
          {!isCollapsed && (
            <span className="font-display text-[10px] font-bold uppercase tracking-wider">
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
