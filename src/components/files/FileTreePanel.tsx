/* FileTreePanel — standalone file tree panel with search and explorer.
 * Used as a building block by FileExplorerView. */

import { useFileExplorerStore } from "@/stores/fileExplorer";
import { FileSearch } from "./FileSearch";
import { FileExplorer } from "./FileExplorer";

/** File tree panel with search and tree browser. */
export function FileTreePanel(): React.JSX.Element {
  const searchQuery = useFileExplorerStore((s) => s.searchQuery);

  return (
    <div
      className="flex h-full shrink-0 flex-col overflow-hidden border-r-[3px] border-border bg-[#1A1A2E]"
      data-testid="file-tree-panel"
    >
      {/* Header */}
      <div className="flex items-center border-b-[2px] border-[#333] px-3 py-2">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#888]">
          Explorer
        </h3>
      </div>

      {/* Search input */}
      <FileSearch />

      {/* File tree content */}
      <div className="flex-1 overflow-y-auto">
        <FileExplorer searchQuery={searchQuery} />
      </div>
    </div>
  );
}
