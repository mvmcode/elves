/* ShareButton — exports a session as a self-contained HTML replay file. */

import { useState } from "react";
import { Button } from "@/components/shared/Button";
import { exportSessionHtml } from "@/lib/tauri";

interface ShareButtonProps {
  readonly sessionId: string;
  readonly sessionTask: string;
}

/**
 * Neo-brutalist share button that exports a session as a self-contained HTML replay file.
 * Calls the Rust backend to generate the HTML, then triggers a browser download.
 */
export function ShareButton({ sessionId, sessionTask }: ShareButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(): Promise<void> {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const html = await exportSessionHtml(sessionId);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      const sanitizedTask = sessionTask
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 40)
        .toLowerCase();
      const filename = `elves-replay-${sanitizedTask || sessionId}.html`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(`Export failed: ${message}`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      variant="secondary"
      className="text-xs"
      onClick={handleExport}
      disabled={isExporting}
      data-testid="share-button"
    >
      {isExporting ? "Exporting..." : "Export Replay"}
    </Button>
  );
}
