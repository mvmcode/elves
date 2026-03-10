/* InsightsReport — renders Claude Code's AI-generated usage report HTML in a sandboxed iframe. */

interface InsightsReportProps {
  readonly reportHtml: string | null;
}

/** AI Report tab — iframe rendering of the Claude Code report.html, or a null state with instructions. */
export function InsightsReport({ reportHtml }: InsightsReportProps): React.JSX.Element {
  if (!reportHtml) {
    return (
      <div className="flex flex-col items-center justify-center py-16" data-testid="report-null-state">
        <p className="font-display text-lg font-bold uppercase tracking-wider text-text-muted">No AI Report</p>
        <p className="mt-2 max-w-md text-center font-body text-sm text-text-muted">
          Claude Code generates a detailed usage report at{" "}
          <code className="border-[2px] border-border bg-surface-elevated px-1 py-0.5 font-mono text-xs">
            ~/.claude/usage-data/report.html
          </code>
          . Run Claude Code to generate this report.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col" data-testid="report-iframe-container">
      <iframe
        srcDoc={reportHtml}
        sandbox="allow-same-origin"
        title="Claude Code AI Report"
        className="flex-1 border-[3px] border-border shadow-brutal"
        style={{ minHeight: 600, width: "100%" }}
        data-testid="report-iframe"
      />
    </div>
  );
}
