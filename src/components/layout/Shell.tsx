/* App shell — thin routing shell: Sidebar + view-switched main area + StatusBar. */

import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { ProjectWorkspace } from "@/components/workspace/ProjectWorkspace";
import { FileExplorerView } from "@/components/files/FileExplorerView";
import { MemoryExplorer } from "@/components/memory/MemoryExplorer";
import { SettingsView } from "@/components/settings/SettingsView";
import { SkillManager } from "@/components/skills/SkillManager";
import { McpManager } from "@/components/editors/McpManager";
import { SessionHistory } from "@/components/project/SessionHistory";
import { SessionComparison } from "@/components/project/SessionComparison";
import { ShortcutOverlay } from "@/components/shared/ShortcutOverlay";
import { ToastContainer } from "@/components/shared/Toast";
import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useTeamSession } from "@/hooks/useTeamSession";
import { useMemoryActions } from "@/hooks/useMemoryActions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionEvents } from "@/hooks/useSessionEvents";
import { useProjectContext } from "@/hooks/useProjectContext";
import { useCheckForUpdate } from "@/hooks/useCheckForUpdate";
import { onEvent } from "@/lib/tauri";

/**
 * Root layout shell — workspace-first structure:
 * ┌────┬──────────────────────────────────┐
 * │Icon│  Main Content (view-switched)    │
 * │Bar │                                  │
 * │    │  workspace | files | memory |    │
 * │ ⚒  │  skills | mcp | history |       │
 * │ 📁 │  settings | comparison          │
 * │ 🧠 │                                  │
 * │ ⚡ │──────────────────────────────────│
 * │ ⚙  │  StatusBar (bottom)              │
 * └────┴──────────────────────────────────┘
 */
export function Shell(): React.JSX.Element {
  const activeView = useUiStore((state) => state.activeView);
  const isNewProjectDialogOpen = useUiStore((state) => state.isNewProjectDialogOpen);
  const setNewProjectDialogOpen = useUiStore((state) => state.setNewProjectDialogOpen);
  const { stopSession } = useTeamSession();
  const {
    handleCreateMemory,
    handleEditMemory,
    handlePinMemory,
    handleDeleteMemory,
    handleSearch,
    handleClearAll,
    handleExportMemories,
    handleImportMemories,
  } = useMemoryActions();
  const { shortcutOverlayOpen, toggleOverlay } = useKeyboardShortcuts({
    onCancelTask: () => void stopSession(),
  });

  /* Subscribe to Tauri backend events (elf:event, session:completed) */
  useSessionEvents();

  /* Load project-scoped context (git state, etc.) when active project changes */
  useProjectContext();

  /* Non-blocking Homebrew update check on launch */
  useCheckForUpdate();

  /* Listen for native menu events from Tauri backend */
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const menuEvents: Record<string, () => void> = {
      "menu:new_floor": () => useSessionStore.getState().createFloor(),
      "menu:close_floor": () => {
        const store = useSessionStore.getState();
        const floorId = store.activeFloorId;
        if (floorId && store.floors[floorId]?.session?.status !== "active") {
          store.closeFloor(floorId);
        }
      },
      "menu:toggle_settings": () => {
        const store = useUiStore.getState();
        store.setActiveView(store.activeView === "settings" ? "workspace" : "settings");
      },
      "menu:keyboard_shortcuts": () => toggleOverlay(),
    };

    for (const [eventName, handler] of Object.entries(menuEvents)) {
      onEvent(eventName, handler)
        .then((unsub) => cleanups.push(unsub))
        .catch((error: unknown) => console.error(`Failed to subscribe to ${eventName}:`, error));
    }

    return () => cleanups.forEach((unsub) => unsub());
  }, [toggleOverlay]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-light">
      {/* Icon sidebar */}
      <Sidebar />

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* View routing */}
        {activeView === "workspace" ? (
          <ProjectWorkspace />
        ) : activeView === "files" ? (
          <FileExplorerView />
        ) : activeView === "memory" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <MemoryExplorer
              onCreateMemory={handleCreateMemory}
              onEditMemory={handleEditMemory}
              onPinMemory={handlePinMemory}
              onDeleteMemory={handleDeleteMemory}
              onSearch={handleSearch}
            />
          </div>
        ) : activeView === "skills" ? (
          <div className="flex flex-1 overflow-hidden">
            <SkillManager />
          </div>
        ) : activeView === "mcp" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <McpManager />
          </div>
        ) : activeView === "history" ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <SessionHistory />
          </div>
        ) : activeView === "comparison" ? (
          <div className="flex flex-1 overflow-hidden">
            <SessionComparison />
          </div>
        ) : activeView === "settings" ? (
          <SettingsView
            onClearAll={handleClearAll}
            onExport={handleExportMemories}
            onImport={handleImportMemories}
          />
        ) : null}

        {/* Shortcut overlay — toggled via Cmd+/ */}
        <ShortcutOverlay isOpen={shortcutOverlayOpen} onClose={toggleOverlay} />

        {/* Status bar */}
        <StatusBar />
      </main>

      {/* New project creation dialog */}
      <NewProjectDialog
        isOpen={isNewProjectDialogOpen}
        onClose={() => setNewProjectDialogOpen(false)}
      />

      {/* Toast notification stack — fixed position, bottom-left */}
      <ToastContainer />
    </div>
  );
}
