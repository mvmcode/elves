/* ShareButton — exports a session as a self-contained HTML replay file via native save dialog. */

import { useState } from "react";
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

  async function handleExport(): Promise<void> {
    if (exportState === "exporting") return;
    setExportState("exporting");

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
      window.alert(`Export failed: ${message}`);
      setExportState("idle");
    }
  }

  const label = exportState === "exporting" ? "Exporting..." : exportState === "saved" ? "Saved!" : "Export Replay";

  return (
    <Button
      variant="secondary"
      className="text-xs"
      onClick={handleExport}
      disabled={exportState === "exporting"}
      data-testid="share-button"
    >
      {label}
    </Button>
  );
}
