/* Project sidebar — lists projects and provides navigation to global settings. */

import { useProjectStore } from "@/stores/project";
import { useUiStore } from "@/stores/ui";
import type { AppView } from "@/stores/ui";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";

/** Navigation items for the sidebar. */
const NAV_ITEMS: readonly { view: AppView; label: string }[] = [
  { view: "session", label: "Workshop" },
  { view: "memory", label: "Memory" },
  { view: "skills", label: "Skills" },
  { view: "mcp", label: "MCP Servers" },
  { view: "history", label: "History" },
  { view: "settings", label: "Settings" },
];

/**
 * Left sidebar showing the project list, global navigation, and branding.
 * Shows a fun empty state when no projects exist.
 */
export function Sidebar(): React.JSX.Element {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setNewProjectDialogOpen = useUiStore((s) => s.setNewProjectDialogOpen);

  return (
    <aside className="no-select flex h-full shrink-0 flex-col border-r-[3px] border-border bg-white">
      {/* Logo / Branding */}
      <div className="flex items-center gap-2 border-b-[3px] border-border p-4">
        <span className="font-display text-2xl font-black uppercase tracking-tight">
          ELVES
        </span>
        <Badge variant="info">v0.1</Badge>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <Button
            variant="primary"
            className="mb-2 w-full py-2 text-xs"
            onClick={() => setNewProjectDialogOpen(true)}
            data-testid="new-project-button"
          >
            + New Project
          </Button>
        </div>
        {projects.length === 0 ? (
          <EmptyState message="No projects yet. Create one above!" />
        ) : (
          <ul className="px-2">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  onClick={() => setActiveProject(project.id)}
                  className={[
                    "w-full border-[2px] p-3 text-left transition-all duration-100",
                    "font-body text-sm font-bold",
                    activeProjectId === project.id
                      ? "border-border bg-elf-gold shadow-brutal-sm"
                      : "border-transparent hover:border-border hover:bg-elf-gold-light",
                  ].join(" ")}
                >
                  {project.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <div className="border-t-[3px] border-border p-2">
        {NAV_ITEMS.map((item, index) => (
          <button
            key={item.view}
            onClick={() => setActiveView(item.view)}
            className={[
              "w-full border-[2px] p-2 text-left font-body text-sm font-bold transition-all duration-100",
              index < NAV_ITEMS.length - 1 ? "mb-1" : "",
              activeView === item.view
                ? "border-border bg-elf-gold shadow-brutal-sm"
                : "border-transparent hover:border-border hover:bg-elf-gold-light",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Bottom section */}
      <div className="border-t-[3px] border-border p-3">
        <p className="font-mono text-xs text-text-light/40">
          Built with cookies
        </p>
      </div>
    </aside>
  );
}
