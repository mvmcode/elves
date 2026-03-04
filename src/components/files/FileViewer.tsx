/* FileViewer — CodeMirror-powered file viewer/editor shown in the main content area.
 * Supports syntax highlighting, read-only viewing, and inline editing with save via Tauri IPC. */

import { useState, useEffect, useCallback, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { useUiStore } from "@/stores/ui";
import { readTextFromFile, writeTextToFile } from "@/lib/tauri";
import { getLanguageExtension } from "@/lib/codemirror-langs";

/** Custom ELVES theme overrides on top of oneDark. */
const elvesTheme = EditorView.theme({
  "&": {
    backgroundColor: "#1A1A2E",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  ".cm-gutters": {
    backgroundColor: "#1A1A2E",
    borderRight: "1px solid #333",
  },
  ".cm-cursor": {
    borderLeftColor: "#FFD93D",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(77, 150, 255, 0.25) !important",
  },
});

/** File viewer and editor with CodeMirror syntax highlighting. */
export function FileViewer(): React.JSX.Element {
  const selectedFilePath = useUiStore((s) => s.selectedFilePath);
  const setSelectedFilePath = useUiStore((s) => s.setSelectedFilePath);
  const isFileEditing = useUiStore((s) => s.isFileEditing);
  const isFileDirty = useUiStore((s) => s.isFileDirty);
  const setFileEditing = useUiStore((s) => s.setFileEditing);
  const setFileDirty = useUiStore((s) => s.setFileDirty);

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const editedContentRef = useRef<string>("");

  /* Load file content when selectedFilePath changes */
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
          editedContentRef.current = text;
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

  /** Handle content changes in the editor. */
  const handleChange = useCallback((value: string): void => {
    editedContentRef.current = value;
    if (!useUiStore.getState().isFileDirty) {
      setFileDirty(true);
    }
  }, [setFileDirty]);

  /** Save edited content to disk via Tauri IPC. */
  const handleSave = useCallback(async (): Promise<void> => {
    if (!selectedFilePath || !isFileDirty) return;
    setSaving(true);
    try {
      await writeTextToFile(selectedFilePath, editedContentRef.current);
      setContent(editedContentRef.current);
      setFileDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [selectedFilePath, isFileDirty, setFileDirty]);

  /** Cancel editing — revert to saved content. */
  const handleCancel = useCallback((): void => {
    if (content !== null) {
      editedContentRef.current = content;
    }
    setFileEditing(false);
    setFileDirty(false);
  }, [content, setFileEditing, setFileDirty]);

  /** Listen for Cmd+S custom event from keyboard shortcuts. */
  useEffect(() => {
    function handleSaveEvent(): void {
      void handleSave();
    }
    window.addEventListener("elves:save-file", handleSaveEvent);
    return () => window.removeEventListener("elves:save-file", handleSaveEvent);
  }, [handleSave]);

  if (!selectedFilePath) return <></>;

  const fileName = selectedFilePath.split("/").pop() ?? selectedFilePath;
  const languageExtensions = getLanguageExtension(selectedFilePath);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#1A1A2E]" data-testid="file-viewer">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-[2px] border-[#333] px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {/* Dirty indicator */}
          {isFileDirty && (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-elf-gold" title="Unsaved changes" />
          )}
          <span className="font-display text-xs font-bold text-[#FFD93D]">{fileName}</span>
          <span className="truncate font-mono text-[10px] text-[#555]" title={selectedFilePath}>
            {selectedFilePath}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isFileEditing ? (
            <>
              <button
                onClick={() => void handleSave()}
                disabled={!isFileDirty || saving}
                className="cursor-pointer border-[2px] border-border bg-success px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-default disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-brutal-sm"
                data-testid="save-file-btn"
              >
                {saving ? "SAVING..." : "SAVE"}
              </button>
              <button
                onClick={handleCancel}
                className="cursor-pointer border-[2px] border-border bg-white px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                data-testid="cancel-edit-btn"
              >
                CANCEL
              </button>
            </>
          ) : (
            <button
              onClick={() => setFileEditing(true)}
              className="cursor-pointer border-[2px] border-border bg-elf-gold px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="edit-file-btn"
            >
              EDIT
            </button>
          )}

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
          <CodeMirror
            value={isFileEditing ? editedContentRef.current : content}
            extensions={[...languageExtensions, elvesTheme]}
            theme={oneDark}
            editable={isFileEditing}
            readOnly={!isFileEditing}
            onChange={isFileEditing ? handleChange : undefined}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
              bracketMatching: true,
              closeBrackets: isFileEditing,
              autocompletion: false,
              indentOnInput: isFileEditing,
            }}
            style={{ height: "100%", overflow: "auto" }}
          />
        )}
      </div>
    </div>
  );
}
