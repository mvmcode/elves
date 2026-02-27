/* Keyboard shortcuts hook — global key bindings for app navigation and actions. */

import { useEffect, useCallback } from "react";
import { useUiStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";

/** Definition of a keyboard shortcut for display in the help overlay. */
export interface ShortcutDef {
  readonly keys: string;
  readonly description: string;
}

/** All registered shortcuts, for rendering in the ShortcutOverlay. */
export const SHORTCUT_DEFINITIONS: readonly ShortcutDef[] = [
  { keys: "⌘ K", description: "Focus task bar" },
  { keys: "⌘ N", description: "New project" },
  { keys: "⌘ 1-9", description: "Switch project by index" },
  { keys: "⌘ .", description: "Cancel current task" },
  { keys: "⌘ M", description: "Toggle memory view" },
  { keys: "⌘ ,", description: "Toggle settings view" },
  { keys: "⌘ /", description: "Toggle shortcut help" },
  { keys: "⌘ B", description: "Toggle activity feed" },
  { keys: "⌘ R", description: "Toggle runtime" },
  { keys: "Escape", description: "Close panel / unfocus" },
] as const;

interface UseKeyboardShortcutsOptions {
  /** Callback for new project action (Cmd+N) */
  readonly onNewProject?: () => void;
  /** Callback for cancel task action (Cmd+.) */
  readonly onCancelTask?: () => void;
}

/**
 * Registers global keyboard shortcuts on the window.
 * Shortcuts use Cmd (Meta) key on macOS.
 * Returns the shortcutOverlayOpen state and toggle function for the overlay.
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {},
): { shortcutOverlayOpen: boolean; toggleOverlay: () => void } {
  const setTaskBarFocused = useUiStore((s) => s.setTaskBarFocused);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const toggleActivityFeed = useUiStore((s) => s.toggleActivityFeed);
  const activeView = useUiStore((s) => s.activeView);
  const isTaskBarFocused = useUiStore((s) => s.isTaskBarFocused);
  const projects = useProjectStore((s) => s.projects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const shortcutOverlayOpen = useUiStore((s) => s.isSettingsOpen && activeView === "settings");

  const toggleOverlay = useCallback((): void => {
    /* We use a dedicated state for the overlay; for now reuse isSettingsOpen */
    setSettingsOpen(!shortcutOverlayOpen);
  }, [shortcutOverlayOpen, setSettingsOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isMeta = event.metaKey || event.ctrlKey;

      /* Escape — close panels, unfocus task bar */
      if (event.key === "Escape") {
        event.preventDefault();
        if (isTaskBarFocused) {
          setTaskBarFocused(false);
        } else {
          setActiveView("session");
        }
        return;
      }

      if (!isMeta) return;

      switch (event.key.toLowerCase()) {
        case "k":
          event.preventDefault();
          setTaskBarFocused(true);
          break;

        case "n":
          event.preventDefault();
          options.onNewProject?.();
          break;

        case ".":
          event.preventDefault();
          options.onCancelTask?.();
          break;

        case "b":
          event.preventDefault();
          toggleActivityFeed();
          break;

        case "m":
          event.preventDefault();
          setActiveView(activeView === "memory" ? "session" : "memory");
          break;

        case ",":
          event.preventDefault();
          setActiveView(activeView === "settings" ? "session" : "settings");
          break;

        case "/":
          event.preventDefault();
          toggleOverlay();
          break;

        case "r":
          /* Handled by RuntimePicker — just prevent default */
          event.preventDefault();
          break;

        default: {
          /* Cmd+1 through Cmd+9 to switch projects */
          const digit = parseInt(event.key, 10);
          if (digit >= 1 && digit <= 9) {
            event.preventDefault();
            const projectIndex = digit - 1;
            if (projectIndex < projects.length) {
              const project = projects[projectIndex];
              if (project) {
                setActiveProject(project.id);
              }
            }
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isTaskBarFocused,
    activeView,
    projects,
    options,
    setTaskBarFocused,
    setActiveView,
    setActiveProject,
    setSettingsOpen,
    toggleOverlay,
    toggleActivityFeed,
  ]);

  return { shortcutOverlayOpen, toggleOverlay };
}
