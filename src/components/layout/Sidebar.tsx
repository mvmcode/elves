/* Project sidebar — lists projects and provides navigation to global settings. */

import { useProjectStore } from "@/stores/project";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Left sidebar showing the project list, global navigation, and branding.
 * Shows a fun empty state when no projects exist.
 */
export function Sidebar(): React.JSX.Element {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  return (
    <aside className="no-select flex w-64 shrink-0 flex-col border-r-[3px] border-border bg-white">
      {/* Logo / Branding */}
      <div className="flex items-center gap-2 border-b-[3px] border-border p-4">
        <span className="font-display text-2xl font-black uppercase tracking-tight">
          ELVES
        </span>
        <Badge variant="info">v0.1</Badge>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <EmptyState message="Your elves are bored. Give them something to do. 🍪" />
        ) : (
          <ul className="p-2">
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

      {/* Bottom section */}
      <div className="border-t-[3px] border-border p-3">
        <p className="font-mono text-xs text-text-light/40">
          Built with cookies 🍪
        </p>
      </div>
    </aside>
  );
}
