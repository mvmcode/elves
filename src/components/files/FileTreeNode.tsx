/* FileTreeNode — recursive tree node for the file explorer.
 * Renders a directory (expandable) or file (with git status indicator and type icon). */

import { useCallback, useMemo } from "react";
import { useFileExplorerStore } from "@/stores/fileExplorer";
import { useUiStore } from "@/stores/ui";
import { listDirectory } from "@/lib/tauri";
import type { FileEntry } from "@/types/filesystem";

interface FileTreeNodeProps {
  readonly entry: FileEntry;
  readonly depth: number;
  readonly projectPath: string;
  readonly gitStatusMap: Readonly<Record<string, string>>;
  readonly searchQuery?: string;
}

/** Map file extension to a display color for the file type icon. */
function extensionColor(ext: string | null): string {
  switch (ext) {
    case "ts":
    case "tsx":
      return "#4D96FF";
    case "rs":
      return "#FF8B3D";
    case "json":
      return "#FFD93D";
    case "md":
    case "mdx":
      return "#888";
    case "css":
    case "scss":
      return "#FF6B6B";
    case "html":
      return "#6BCB77";
    case "js":
    case "jsx":
      return "#FFD93D";
    case "toml":
    case "yaml":
    case "yml":
      return "#FF8B3D";
    default:
      return "#aaa";
  }
}

/** SVG icon for file type based on extension. */
function FileTypeIcon({ extension }: { readonly extension: string | null }): React.JSX.Element {
  const color = extensionColor(extension);

  switch (extension) {
    case "ts":
    case "tsx":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
          <text x="12" y="16" textAnchor="middle" fill={color} fontSize="10" fontWeight="bold" fontFamily="monospace">TS</text>
        </svg>
      );
    case "js":
    case "jsx":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
          <text x="12" y="16" textAnchor="middle" fill={color} fontSize="10" fontWeight="bold" fontFamily="monospace">JS</text>
        </svg>
      );
    case "rs":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
          <text x="12" y="16" textAnchor="middle" fill={color} fontSize="10" fontWeight="bold" fontFamily="monospace">RS</text>
        </svg>
      );
    case "json":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
          <text x="12" y="16" textAnchor="middle" fill={color} fontSize="9" fontWeight="bold" fontFamily="monospace">{"{}"}</text>
        </svg>
      );
    case "md":
    case "mdx":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
          <text x="12" y="16" textAnchor="middle" fill={color} fontSize="9" fontWeight="bold" fontFamily="monospace">MD</text>
        </svg>
      );
    case "css":
    case "scss":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" />
          <text x="12" y="16" textAnchor="middle" fill={color} fontSize="9" fontWeight="bold" fontFamily="monospace">#</text>
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
}

/** Git status indicator color and label. */
function gitStatusIndicator(code: string): { color: string; label: string } | null {
  const index = code.trim();
  if (index.startsWith("M") || index.endsWith("M")) return { color: "#FF8B3D", label: "Modified" };
  if (index.startsWith("A")) return { color: "#6BCB77", label: "Added" };
  if (index.startsWith("D") || index.endsWith("D")) return { color: "#FF6B6B", label: "Deleted" };
  if (index === "??") return { color: "#888", label: "Untracked" };
  if (index.startsWith("R")) return { color: "#4D96FF", label: "Renamed" };
  if (index.startsWith("C")) return { color: "#4D96FF", label: "Copied" };
  if (index === "!!") return { color: "#555", label: "Ignored" };
  if (index.startsWith("U")) return { color: "#FF6B6B", label: "Conflict" };
  return null;
}

/** Check if a directory has any children with git status changes. */
function dirHasGitChanges(
  dirRelativePath: string,
  gitStatusMap: Readonly<Record<string, string>>,
): boolean {
  const prefix = dirRelativePath.endsWith("/") ? dirRelativePath : `${dirRelativePath}/`;
  return Object.keys(gitStatusMap).some((filePath) => filePath.startsWith(prefix));
}

/** Recursively checks if an entry or any descendant matches the search query. */
function entryMatchesSearch(
  entry: FileEntry,
  query: string,
  dirCache: ReadonlyMap<string, readonly FileEntry[]>,
): boolean {
  const lowerQuery = query.toLowerCase();
  if (entry.name.toLowerCase().includes(lowerQuery)) return true;
  if (entry.isDir) {
    const children = dirCache.get(entry.path);
    if (children) {
      return children.some((child) => entryMatchesSearch(child, query, dirCache));
    }
  }
  return false;
}

export function FileTreeNode({ entry, depth, projectPath, gitStatusMap, searchQuery }: FileTreeNodeProps): React.JSX.Element {
  const expandedDirs = useFileExplorerStore((s) => s.expandedDirs);
  const dirCache = useFileExplorerStore((s) => s.dirCache);
  const loadingDirs = useFileExplorerStore((s) => s.loadingDirs);
  const toggleDir = useFileExplorerStore((s) => s.toggleDir);
  const setDirEntries = useFileExplorerStore((s) => s.setDirEntries);
  const setDirLoading = useFileExplorerStore((s) => s.setDirLoading);
  const selectedFilePath = useUiStore((s) => s.selectedFilePath);
  const setSelectedFilePath = useUiStore((s) => s.setSelectedFilePath);

  const isExpanded = expandedDirs.has(entry.path);
  const isLoading = loadingDirs.has(entry.path);
  const children = dirCache.get(entry.path);

  /** Compute the relative path from the project root for git status lookup. */
  const relativePath = entry.path.startsWith(projectPath)
    ? entry.path.slice(projectPath.length + 1)
    : entry.name;

  const handleToggle = useCallback(async (): Promise<void> => {
    toggleDir(entry.path);

    if (!expandedDirs.has(entry.path) && !dirCache.has(entry.path)) {
      setDirLoading(entry.path, true);
      try {
        const entries = await listDirectory(entry.path);
        setDirEntries(entry.path, entries);
      } catch (error) {
        console.error(`Failed to list directory ${entry.path}:`, error);
      } finally {
        setDirLoading(entry.path, false);
      }
    }
  }, [entry.path, expandedDirs, dirCache, toggleDir, setDirEntries, setDirLoading]);

  const handleFileClick = useCallback((): void => {
    setSelectedFilePath(entry.path);
  }, [entry.path, setSelectedFilePath]);

  /** Filter children by search query when present. */
  const filteredChildren = useMemo(() => {
    if (!children || !searchQuery?.trim()) return children;
    return children.filter((child) => entryMatchesSearch(child, searchQuery, dirCache));
  }, [children, searchQuery, dirCache]);

  const paddingLeft = 12 + depth * 16;

  if (entry.isDir) {
    const hasChanges = dirHasGitChanges(relativePath, gitStatusMap);

    return (
      <div>
        <button
          onClick={handleToggle}
          className="flex w-full cursor-pointer items-center gap-1.5 border-none bg-transparent py-[3px] pr-2 text-left font-mono text-xs text-[#c8c5bd] transition-colors duration-75 hover:bg-white/[0.04]"
          style={{ paddingLeft }}
        >
          {/* Chevron */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-[#666] transition-transform duration-100"
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>

          {/* Folder icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={isExpanded ? "#FFD93D" : "#888"}
            stroke="none"
            className="shrink-0"
          >
            {isExpanded ? (
              <path d="M20 19a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h4l2 2h6a2 2 0 012 2v2H10l-2 4v6h10z" />
            ) : (
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            )}
          </svg>

          {/* Name */}
          <span className="truncate font-bold">{entry.name}</span>

          {/* Git change indicator on directory */}
          {hasChanges && (
            <span
              className="ml-auto h-[6px] w-[6px] shrink-0 rounded-full bg-[#FF8B3D]"
              title="Contains changes"
            />
          )}

          {/* Loading indicator */}
          {isLoading && (
            <span className="ml-auto font-mono text-[10px] text-[#666]">...</span>
          )}
        </button>

        {/* Children — rendered when expanded */}
        {isExpanded && filteredChildren && (
          <div>
            {filteredChildren.map((child) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                projectPath={projectPath}
                gitStatusMap={gitStatusMap}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  const gitCode = gitStatusMap[relativePath];
  const indicator = gitCode ? gitStatusIndicator(gitCode) : null;
  const isDeleted = gitCode?.trim().startsWith("D") || gitCode?.trim().endsWith("D");
  const isUntracked = gitCode === "??";
  const isSelected = selectedFilePath === entry.path;

  return (
    <button
      onClick={handleFileClick}
      className={[
        "flex w-full cursor-pointer items-center gap-1.5 border-none py-[3px] pr-2 text-left font-mono text-xs transition-colors duration-75",
        isSelected
          ? "bg-white/[0.08] text-[#c8c5bd]"
          : "bg-transparent text-[#9a9790] hover:bg-white/[0.04]",
      ].join(" ")}
      style={{ paddingLeft }}
      title={indicator ? `${indicator.label}: ${relativePath}` : relativePath}
    >
      {/* Spacer for alignment with chevrons */}
      <span className="w-3 shrink-0" />

      {/* File type icon */}
      <FileTypeIcon extension={entry.extension} />

      {/* File name */}
      <span
        className={[
          "truncate",
          isDeleted ? "line-through text-[#FF6B6B]/60" : "",
          isUntracked ? "italic text-[#888]" : "",
        ].join(" ")}
      >
        {entry.name}
      </span>

      {/* Git status dot */}
      {indicator && (
        <span
          className="ml-auto h-[6px] w-[6px] shrink-0 rounded-full"
          style={{ backgroundColor: indicator.color }}
          title={indicator.label}
        />
      )}
    </button>
  );
}
