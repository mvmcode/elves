/* FileViewer — read-only file content viewer shown in the main content area.
 * Displays file content with line numbers and a breadcrumb path header. */

import { useState, useEffect } from "react";
import { useUiStore } from "@/stores/ui";
import { readTextFromFile } from "@/lib/tauri";

/** Read-only file viewer with line numbers, breadcrumb path, and close button. */
export function FileViewer(): React.JSX.Element {
  const selectedFilePath = useUiStore((s) => s.selectedFilePath);
  const setSelectedFilePath = useUiStore((s) => s.setSelectedFilePath);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFilePath) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    readTextFromFile(selectedFilePath)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [selectedFilePath]);

  if (!selectedFilePath) return <></>;

  const fileName = selectedFilePath.split("/").pop() ?? selectedFilePath;
  const lines = content?.split("\n") ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-t-[2px] border-border bg-[#1A1A2E]" data-testid="file-viewer">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between border-b-[2px] border-[#333] px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="font-display text-xs font-bold text-[#FFD93D]">{fileName}</span>
          <span className="truncate font-mono text-[10px] text-[#555]" title={selectedFilePath}>
            {selectedFilePath}
          </span>
        </div>
        <button
          onClick={() => setSelectedFilePath(null)}
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[#666] transition-colors hover:text-[#ccc]"
          title="Close file"
          data-testid="close-file-viewer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <p className="px-4 py-3 font-mono text-xs text-[#555]">Loading...</p>
        )}
        {error && (
          <p className="px-4 py-3 font-mono text-xs text-[#FF6B6B]">Error: {error}</p>
        )}
        {content !== null && (
          <pre className="m-0 font-mono text-[13px] leading-5">
            <code>
              {lines.map((line, index) => (
                <div key={index} className="flex hover:bg-white/[0.03]">
                  <span className="inline-block w-12 shrink-0 select-none pr-3 text-right text-[#444]">
                    {index + 1}
                  </span>
                  <span className="flex-1 whitespace-pre text-[#c8c5bd]">{line}</span>
                </div>
              ))}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
