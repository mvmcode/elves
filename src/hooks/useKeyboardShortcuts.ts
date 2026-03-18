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

/** Modifier key label — ⌘ on macOS, Ctrl on Windows/Linux. */
const MOD =
  typeof navigator !== "undefined" && navigator.platform?.startsWith("Mac")
    ? "⌘"
    : "Ctrl";

/** All registered shortcuts, for rendering in the ShortcutOverlay. */
export const SHORTCUT_DEFINITIONS: readonly ShortcutDef[] = [
  { keys: `${MOD} K`, description: "Focus task bar" },
  { keys: `${MOD} N`, description: "New project" },
  { keys: `${MOD} T`, description: "New floor" },
  { keys: `${MOD} W`, description: "Close active floor" },
  { keys: `${MOD} ⇧ ]`, description: "Next floor" },
  { keys: `${MOD} ⇧ [`, description: "Previous floor" },
  { keys: `${MOD} 1-9`, description: "Switch project by index" },
  { keys: `${MOD} .`, description: "Cancel current task" },
  { keys: `${MOD} \``, description: "Toggle terminal panel" },
  { keys: `${MOD} M`, description: "Toggle memory view" },
  { keys: `${MOD} ,`, description: "Toggle settings view" },
  { keys: `${MOD} /`, description: "Toggle shortcut help" },
  { keys: `${MOD} B`, description: "Toggle activity feed" },
  { keys: `${MOD} R`, description: "Toggle runtime" },
  { keys: `${MOD} ⇧ F`, description: "Toggle focus mode" },
  { keys: `${MOD} S`, description: "Save open file" },
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
 * Shortcuts use Cmd (Meta) on macOS, Ctrl on Windows/Linux.
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
          setActiveView("workspace");
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
          case "f": {
            event.preventDefault();
            useUiStore.getState().toggleFocusMode();
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
          setActiveView(activeView === "memory" ? "workspace" : "memory");
          break;

        case ",":
          event.preventDefault();
          setActiveView(activeView === "settings" ? "workspace" : "settings");
          break;

        case "/":
          event.preventDefault();
          toggleOverlay();
          break;

        case "r":
          /* Handled by RuntimePicker — just prevent default */
          event.preventDefault();
          break;

        case "s": {
          event.preventDefault();
          const ui = useUiStore.getState();
          if (ui.isFileEditing && ui.isFileDirty) {
            window.dispatchEvent(new CustomEvent("elves:save-file"));
          }
          break;
        }

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
