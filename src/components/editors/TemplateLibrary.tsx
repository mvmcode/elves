/* TemplateLibrary — neo-brutalist card grid of saved and built-in task templates. */

import { useTemplateStore } from "@/stores/templates";
import { useTemplateActions } from "@/hooks/useTemplateActions";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEmptyState } from "@/lib/funny-copy";
import type { Template } from "@/types/template";

interface TemplateLibraryProps {
  /** Called when a template is selected for use. Receives the loaded template. */
  readonly onSelectTemplate?: (template: Template) => void;
}

/**
 * Grid of template cards showing built-in and custom saved plans.
 * Each card shows the template name, description, role count, and agent info.
 * Built-in templates show a badge; custom templates show a delete button.
 */
export function TemplateLibrary({
  onSelectTemplate,
}: TemplateLibraryProps): React.JSX.Element {
  const templates = useTemplateStore((s) => s.templates);
  const isLoading = useTemplateStore((s) => s.isLoading);
  const { handleDeleteTemplate, handleLoadTemplate } = useTemplateActions();

  const handleSelect = (template: Template): void => {
    void (async () => {
      const loaded = await handleLoadTemplate(template.id);
      if (loaded && onSelectTemplate) {
        onSelectTemplate(loaded);
      }
    })();
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="font-display text-xl font-bold text-text-light/40">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    const empty = getEmptyState("no-templates");
    return (
      <div data-testid="template-library-empty">
        <EmptyState message={`${empty.emoji} ${empty.title}`} submessage={empty.subtitle} />
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="template-library">
      {/* Header */}
      <h2 className="mb-4 font-display text-2xl font-black uppercase tracking-tight">
        Templates
      </h2>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="border-[3px] border-border bg-white p-4 shadow-brutal-lg transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm"
            data-testid="template-card"
          >
            {/* Card header */}
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-display text-lg font-bold uppercase">{template.name}</h3>
              {template.builtIn && (
                <Badge variant="info">Built-in</Badge>
              )}
            </div>

            {/* Description */}
            {template.description && (
              <p className="mb-3 font-body text-sm text-text-light/70">
                {template.description}
              </p>
            )}

            {/* Plan info */}
            <div className="mb-3 flex items-center gap-3">
              <span className="border-[2px] border-border bg-elf-gold-light px-2 py-0.5 font-mono text-xs font-bold">
                {template.plan.agentCount} {template.plan.agentCount === 1 ? "elf" : "elves"}
              </span>
              <span className="font-body text-xs text-text-light/50">
                {template.plan.roles.length} {template.plan.roles.length === 1 ? "role" : "roles"}
              </span>
            </div>

            {/* Role pills */}
            <div className="mb-4 flex flex-wrap gap-1">
              {template.plan.roles.slice(0, 4).map((role, index) => (
                <span
                  key={index}
                  className="border-[2px] border-border/40 bg-white px-2 py-0.5 font-body text-xs"
                >
                  {role.name}
                </span>
              ))}
              {template.plan.roles.length > 4 && (
                <span className="px-1 font-body text-xs text-text-light/40">
                  +{template.plan.roles.length - 4} more
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="flex-1 py-2 text-xs"
                onClick={() => handleSelect(template)}
              >
                Use Template
              </Button>
              {!template.builtIn && (
                <Button
                  variant="danger"
                  className="py-2 text-xs"
                  onClick={() => handleDeleteTemplate(template)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
