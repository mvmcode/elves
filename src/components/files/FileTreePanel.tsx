/* FileTreePanel — collapsible side panel containing file search and file explorer tree.
 * Renders between the icon sidebar and main content area when isFileTreeVisible is true. */

import { useUiStore } from "@/stores/ui";
import { useFileExplorerStore } from "@/stores/fileExplorer";
import { FileSearch } from "./FileSearch";
import { FileExplorer } from "./FileExplorer";

/** IDE-like file tree side panel with search and tree browser. */
export function FileTreePanel(): React.JSX.Element {
  const fileTreeWidth = useUiStore((s) => s.fileTreeWidth);
  const toggleFileTree = useUiStore((s) => s.toggleFileTree);
  const searchQuery = useFileExplorerStore((s) => s.searchQuery);

  return (
    <div
      className="flex h-full shrink-0 flex-col overflow-hidden border-r-[3px] border-border bg-[#1A1A2E]"
      style={{ width: fileTreeWidth }}
      data-testid="file-tree-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-[2px] border-[#333] px-3 py-2">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#888]">
          Explorer
        </h3>
        <button
          onClick={toggleFileTree}
          className="flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent text-[#666] transition-colors hover:text-[#ccc]"
          title="Close file explorer"
          data-testid="close-file-tree"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
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
