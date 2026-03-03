/* ShareButton — exports a session as a self-contained HTML replay file via native save dialog. */

import { useState, useEffect } from "react";
import { Button } from "@/components/shared/Button";
import { saveSessionReplay } from "@/lib/tauri";

interface ShareButtonProps {
  readonly sessionId: string;
  readonly sessionTask: string;
}

/** Transient button state during and after export. */
type ExportState = "idle" | "exporting" | "saved";

/**
 * Neo-brutalist share button that exports a session as a self-contained HTML replay file.
 * Uses Tauri's native save dialog to write the file to disk (the Blob+anchor approach
 * silently fails in Tauri WebView).
 */
export function ShareButton({ sessionId }: ShareButtonProps): React.JSX.Element {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* Auto-clear error after 5 seconds */
  useEffect(() => {
    if (errorMessage === null) return;
    const timer = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  async function handleExport(): Promise<void> {
    if (exportState === "exporting") return;
    setExportState("exporting");
    setErrorMessage(null);

    try {
      const saved = await saveSessionReplay(sessionId);
      if (saved) {
        setExportState("saved");
        setTimeout(() => setExportState("idle"), 2000);
      } else {
        /* User cancelled the save dialog */
        setExportState("idle");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Export failed: ${message}`);
      setExportState("idle");
    }
  }

  const label = exportState === "exporting" ? "Exporting..." : exportState === "saved" ? "Saved!" : "Export Replay";

  return (
    <div>
      <Button
        variant="secondary"
        className="text-xs"
        onClick={handleExport}
        disabled={exportState === "exporting"}
        data-testid="share-button"
      >
        {label}
      </Button>
      {errorMessage !== null && (
        <p className="text-xs mt-1 font-bold" style={{ color: "#FF6B6B" }} data-testid="share-error">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
