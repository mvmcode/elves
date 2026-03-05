/* FileExplorerView — full-width files view combining file tree and file viewer.
 * Replaces the old side-panel pattern with a proper view routed from Shell. */

import { useUiStore } from "@/stores/ui";
import { useFileExplorerStore } from "@/stores/fileExplorer";
import { FileSearch } from "./FileSearch";
import { FileExplorer } from "./FileExplorer";
import { FileViewer } from "./FileViewer";

/**
 * Full-width file explorer view — file tree on left (fixed 250px) + FileViewer on right (flex-1).
 * Rendered when activeView === "files".
 */
export function FileExplorerView(): React.JSX.Element {
  const selectedFilePath = useUiStore((s) => s.selectedFilePath);
  const searchQuery = useFileExplorerStore((s) => s.searchQuery);

  return (
    <div className="flex flex-1 overflow-hidden" data-testid="file-explorer-view">
      {/* Left: file tree */}
      <div className="flex h-full w-[250px] shrink-0 flex-col overflow-hidden border-r-[3px] border-border bg-[#1A1A2E]">
        {/* Header */}
        <div className="flex items-center border-b-[2px] border-[#333] px-3 py-2">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#888]">
            Explorer
          </h3>
        </div>

        {/* Search */}
        <FileSearch />

        {/* Tree */}
        <div className="flex-1 overflow-y-auto">
          <FileExplorer searchQuery={searchQuery} />
        </div>
      </div>

      {/* Right: file viewer or empty state */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedFilePath ? (
          <FileViewer />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#1A1A2E]">
            <p className="font-display text-sm text-[#555]">
              Select a file to view
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
