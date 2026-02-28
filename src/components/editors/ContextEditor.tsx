/* ContextEditor — section-based editor for the project's agent context (CLAUDE.md). */

import { useState, useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { useAppStore } from "@/stores/app";
import { getRuntimeControlConfig } from "@/lib/runtime-controls";
import { buildProjectContext } from "@/lib/tauri";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";

/** Predefined context sections with default content. */
interface ContextSection {
  readonly id: string;
  readonly title: string;
  readonly placeholder: string;
  readonly enabled: boolean;
  readonly content: string;
}

const DEFAULT_SECTIONS: readonly ContextSection[] = [
  {
    id: "overview",
    title: "Project Overview",
    placeholder: "Describe what this project does, its purpose, and key goals...",
    enabled: true,
    content: "",
  },
  {
    id: "architecture",
    title: "Architecture",
    placeholder: "Key architectural decisions, tech stack, directory structure...",
    enabled: true,
    content: "",
  },
  {
    id: "standards",
    title: "Coding Standards",
    placeholder: "Style guide rules, naming conventions, testing requirements...",
    enabled: true,
    content: "",
  },
  {
    id: "instructions",
    title: "Custom Instructions",
    placeholder: "Any custom instructions for the elves (preferred libraries, do/don't rules)...",
    enabled: true,
    content: "",
  },
];

/**
 * Section-based context editor for building project agent context.
 * Each section has a toggle to enable/disable and a textarea for content.
 * Includes a read-only preview of auto-generated memory context and a
 * full preview button that combines all sections.
 */
export function ContextEditor(): React.JSX.Element {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const controlConfig = getRuntimeControlConfig(defaultRuntime);
  const contextFileName = controlConfig.contextFileName ?? "CLAUDE.md";

  const [sections, setSections] = useState<readonly ContextSection[]>(DEFAULT_SECTIONS);
  const [autoContext, setAutoContext] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  /** Toggle a section on or off. */
  const handleToggleSection = useCallback((sectionId: string): void => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, enabled: !s.enabled } : s)),
    );
  }, []);

  /** Update a section's content. */
  const handleContentChange = useCallback((sectionId: string, content: string): void => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, content } : s)),
    );
  }, []);

  /** Load auto-context from memory system. */
  const handleLoadAutoContext = useCallback((): void => {
    if (!activeProjectId) return;
    setIsLoadingContext(true);
    void (async () => {
      try {
        const context = await buildProjectContext(activeProjectId);
        setAutoContext(context);
      } catch (error) {
        console.error("Failed to load auto-context:", error);
        setAutoContext("Failed to load auto-context.");
      } finally {
        setIsLoadingContext(false);
      }
    })();
  }, [activeProjectId]);

  /** Build the full context preview from all enabled sections. */
  const buildFullPreview = useCallback((): string => {
    const parts: string[] = [];
    for (const section of sections) {
      if (section.enabled && section.content.trim()) {
        parts.push(`## ${section.title}\n\n${section.content.trim()}`);
      }
    }
    if (autoContext) {
      parts.push(`## Auto-Context (from Memory)\n\n${autoContext}`);
    }
    return parts.length > 0
      ? parts.join("\n\n---\n\n")
      : "No context configured. Add content to the sections above.";
  }, [sections, autoContext]);

  if (!activeProjectId) {
    return (
      <div data-testid="context-editor-no-project">
        <EmptyState
          message="No project selected"
          submessage="Select a project to configure its context."
        />
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="context-editor">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-heading tracking-tight">
            Context Editor
          </h2>
          <p className="font-mono text-xs font-bold text-text-light/50" data-testid="context-file-label">
            Editing {contextFileName}
          </p>
        </div>
        <Button
          variant="primary"
          className="text-xs"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? "Hide Preview" : "Preview Full Context"}
        </Button>
      </div>

      {/* Full context preview */}
      {showPreview && (
        <div
          className="mb-4 border-token-normal border-border bg-surface-inset rounded-token-md p-4 shadow-brutal"
          data-testid="context-preview"
        >
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-inset">
            {buildFullPreview()}
          </pre>
        </div>
      )}

      {/* Editable sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className={[
              "border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal-lg transition-opacity duration-100",
              section.enabled ? "" : "opacity-50",
            ].join(" ")}
            data-testid="context-section"
          >
            {/* Section header with toggle */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg text-heading">{section.title}</h3>
              <button
                onClick={() => handleToggleSection(section.id)}
                className={[
                  "relative h-6 w-11 cursor-pointer border-token-thin border-border transition-colors duration-100",
                  section.enabled ? "bg-success" : "bg-surface-muted",
                ].join(" ")}
                data-testid="context-section-toggle"
                role="switch"
                aria-checked={section.enabled}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 border-[1px] border-border bg-white transition-transform duration-100"
                  style={{ left: section.enabled ? "20px" : "2px" }}
                />
              </button>
            </div>

            {/* Section editor */}
            {section.enabled && (
              <textarea
                value={section.content}
                onChange={(event) => handleContentChange(section.id, event.target.value)}
                placeholder={section.placeholder}
                rows={4}
                className="w-full resize-y border-token-thin border-border/40 bg-surface-elevated rounded-token-md p-3 font-body text-sm outline-none focus:border-border focus:focus-ring"
                data-testid="context-section-editor"
              />
            )}
          </div>
        ))}

        {/* Auto-context section (read-only) */}
        <div
          className="border-token-normal border-border bg-accent-light rounded-token-md p-4 shadow-brutal-lg"
          data-testid="auto-context-section"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-heading">
              Auto-Context (Memory)
            </h3>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={handleLoadAutoContext}
              disabled={isLoadingContext}
            >
              {isLoadingContext ? "Loading..." : "Refresh"}
            </Button>
          </div>
          {autoContext ? (
            <pre
              className="whitespace-pre-wrap border-token-thin border-border/40 bg-surface-elevated rounded-token-sm p-3 font-mono text-xs leading-relaxed text-text-light/70"
              data-testid="auto-context-content"
            >
              {autoContext}
            </pre>
          ) : (
            <p className="font-body text-sm italic text-text-light/50">
              Click Refresh to load auto-generated context from memory.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
