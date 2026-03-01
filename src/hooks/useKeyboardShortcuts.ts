/* Keyboard shortcuts hook — global key bindings for app navigation, floor management, and actions. */

import { useEffect, useCallback } from "react";
import { useUiStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useSessionStore } from "@/stores/session";

/** Definition of a keyboard shortcut for display in the help overlay. */
export interface ShortcutDef {
  readonly keys: string;
  readonly description: string;
}

/** All registered shortcuts, for rendering in the ShortcutOverlay. */
export const SHORTCUT_DEFINITIONS: readonly ShortcutDef[] = [
  { keys: "⌘ K", description: "Focus task bar" },
  { keys: "⌘ N", description: "New project" },
  { keys: "⌘ T", description: "New floor" },
  { keys: "⌘ W", description: "Close active floor" },
  { keys: "⌘ ⇧ ]", description: "Next floor" },
  { keys: "⌘ ⇧ [", description: "Previous floor" },
  { keys: "⌘ 1-9", description: "Switch project by index" },
  { keys: "⌘ .", description: "Cancel current task" },
  { keys: "⌘ `", description: "Toggle terminal panel" },
  { keys: "⌘ M", description: "Toggle memory view" },
  { keys: "⌘ ,", description: "Toggle settings view" },
  { keys: "⌘ /", description: "Toggle shortcut help" },
  { keys: "⌘ B", description: "Toggle activity feed" },
  { keys: "⌘ R", description: "Toggle runtime" },
  { keys: "Space", description: "Toggle workshop / card view" },
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
  const toggleTerminalPanel = useUiStore((s) => s.toggleTerminalPanel);
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

      /* Cmd+Shift shortcuts — floor navigation */
      if (event.shiftKey) {
        switch (event.key) {
          case "]": {
            event.preventDefault();
            const store = useSessionStore.getState();
            const floors = store.getOrderedFloors();
            const currentIdx = floors.findIndex((f) => f.id === store.activeFloorId);
            const nextFloor = floors[currentIdx + 1];
            if (currentIdx < floors.length - 1 && nextFloor) {
              store.switchFloor(nextFloor.id);
            }
            return;
          }
          case "[": {
            event.preventDefault();
            const store = useSessionStore.getState();
            const floors = store.getOrderedFloors();
            const currentIdx = floors.findIndex((f) => f.id === store.activeFloorId);
            const prevFloor = floors[currentIdx - 1];
            if (currentIdx > 0 && prevFloor) {
              store.switchFloor(prevFloor.id);
            }
            return;
          }
          default:
            break;
        }
      }

      switch (event.key.toLowerCase()) {
        case "k":
          event.preventDefault();
          setTaskBarFocused(true);
          break;

        case "n":
          event.preventDefault();
          options.onNewProject?.();
          break;

        case "t":
          event.preventDefault();
          useSessionStore.getState().createFloor();
          break;

        case "w": {
          event.preventDefault();
          const store = useSessionStore.getState();
          const activeFloorId = store.activeFloorId;
          if (activeFloorId) {
            const floor = store.floors[activeFloorId];
            /* If the floor has an active session, do not close — user must stop it first */
            if (floor?.session?.status === "active") {
              break;
            }
            store.closeFloor(activeFloorId);
          }
          break;
        }

        case ".":
          event.preventDefault();
          options.onCancelTask?.();
          break;

        case "`":
          event.preventDefault();
          toggleTerminalPanel();
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
    toggleTerminalPanel,
  ]);

  return { shortcutOverlayOpen, toggleOverlay };
}
