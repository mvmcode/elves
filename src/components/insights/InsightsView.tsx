/* InsightsView — root view for the Insights Dashboard with tab navigation.
 * Reads Claude Code usage telemetry and presents Overview, Timeline, Analysis, and AI Report tabs. */

import { useState, useCallback } from "react";
import { useInsights } from "@/hooks/useInsights";
import { useAppStore } from "@/stores/app";
import { InsightsOverview } from "./InsightsOverview";
import { InsightsTimeline } from "./InsightsTimeline";
import { InsightsAnalysis } from "./InsightsAnalysis";
import { InsightsReport } from "./InsightsReport";

/** Available tabs in the insights dashboard. */
type InsightsTab = "overview" | "timeline" | "analysis" | "report";

const TABS: readonly { readonly id: InsightsTab; readonly label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "analysis", label: "Analysis" },
  { id: "report", label: "AI Report" },
];

/** Insights dashboard — tab bar + routed tab content panels. */
export function InsightsView(): React.JSX.Element {
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const isCodex = defaultRuntime === "codex";
  const { data, isLoading, error, reload } = useInsights();
  const [activeTab, setActiveTab] = useState<InsightsTab>("overview");

  const handleReload = useCallback((): void => {
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="insights-view">
      {/* Header + tab bar */}
      <div className="flex shrink-0 items-center justify-between border-b-[3px] border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-2xl font-black uppercase tracking-tight">Insights</h1>
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "cursor-pointer border-[2px] px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-all duration-100",
                  activeTab === tab.id
                    ? "border-border bg-elf-gold text-text-light shadow-brutal-xs"
                    : "border-border/40 bg-transparent text-text-muted hover:border-border hover:bg-surface-elevated hover:text-text-light",
                ].join(" ")}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleReload}
          disabled={isLoading}
          className="cursor-pointer border-[2px] border-border bg-surface-elevated px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-text-muted transition-all duration-100 hover:bg-elf-gold hover:text-text-light hover:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6">
        {isCodex ? (
          <div className="flex flex-col items-center justify-center py-24" data-testid="codex-coming-soon">
            <p className="font-display text-2xl font-black uppercase tracking-tight text-text-muted">Coming Soon</p>
            <p className="mt-2 max-w-md text-center font-body text-sm text-text-muted">
              Codex insights are not yet available. Switch to Claude Code to view usage analytics, session history, and the AI-generated report.
            </p>
          </div>
        ) : error ? (
          <div className="border-[3px] border-border bg-error/10 p-6 shadow-brutal">
            <p className="font-display text-sm font-bold uppercase text-error">Failed to load insights</p>
            <p className="mt-1 font-body text-sm text-text-muted">{error}</p>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 border-[3px] border-border border-t-elf-gold" style={{ animation: "spin 0.6s linear infinite", borderRadius: "50%" }} />
            <p className="mt-3 font-display text-sm font-bold uppercase tracking-wider text-text-muted">Loading insights…</p>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <InsightsOverview data={data} />}
            {activeTab === "timeline" && <InsightsTimeline data={data} />}
            {activeTab === "analysis" && <InsightsAnalysis data={data} />}
            {activeTab === "report" && <InsightsReport reportHtml={data.reportHtml} />}
          </>
        )}
      </div>
    </div>
  );
}
