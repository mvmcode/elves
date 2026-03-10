/* InsightsAnalysis — outcome distribution, session quality, goals, friction, feature adoption,
 * and recent sessions list. */

import type { InsightsData } from "@/types/insights";
import { BarChart } from "./charts/BarChart";

interface InsightsAnalysisProps {
  readonly data: InsightsData;
}

/** Color map for common outcome types. */
const OUTCOME_COLORS: Record<string, string> = {
  fully_achieved: "#6BCB77",
  mostly_achieved: "#FFD93D",
  partially_achieved: "#FF8B3D",
  not_achieved: "#FF6B6B",
  abandoned: "#999",
};

/** Outcome badge color. */
function outcomeBadgeColor(outcome: string): string {
  return OUTCOME_COLORS[outcome.toLowerCase()] ?? "#4D96FF";
}

/** Format a percentage for feature adoption. */
function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

/** Analysis tab — outcomes, quality, goals, friction, feature adoption, recent sessions. */
export function InsightsAnalysis({ data }: InsightsAnalysisProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      {/* Outcome distribution */}
      <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Outcome Distribution</h3>
        {data.outcomes.length > 0 ? (
          <div className="flex flex-col gap-2">
            {data.outcomes.map((entry) => {
              const color = outcomeBadgeColor(entry.outcome);
              return (
                <div key={entry.outcome} className="flex items-center gap-3">
                  <span className="w-32 truncate font-mono text-xs font-bold">{entry.outcome.replace(/_/g, " ")}</span>
                  <div className="relative h-5 flex-1 border-[2px] border-border bg-surface">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${entry.percentage}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono text-xs font-bold">
                    {entry.count} ({entry.percentage.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center font-body text-sm text-text-muted">No outcome data available</p>
        )}
      </div>

      {/* Session quality — 3-column grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Helpfulness</h3>
          <BarChart items={data.topHelpfulness} color="#4D96FF" />
        </div>
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Satisfaction</h3>
          <BarChart items={data.topSatisfaction} color="#6BCB77" />
        </div>
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Session Types</h3>
          <BarChart items={data.topSessionTypes} color="#FFD93D" />
        </div>
      </div>

      {/* Goals + Friction — 2-column */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Top Goals</h3>
          <BarChart items={data.topGoals} color="#FFD93D" />
        </div>
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Friction Points</h3>
          <BarChart items={data.topFriction} color="#FF6B6B" />
        </div>
      </div>

      {/* Top tools + languages — 2-column */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Top Tools</h3>
          <BarChart items={data.topTools} color="#4D96FF" />
        </div>
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Top Languages</h3>
          <BarChart items={data.topLanguages} color="#6BCB77" />
        </div>
      </div>

      {/* Feature Adoption — 4 stat boxes */}
      <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Feature Adoption</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Task Agent", count: data.featureAdoption.taskAgent, color: "#4D96FF" },
            { label: "MCP", count: data.featureAdoption.mcp, color: "#6BCB77" },
            { label: "Web Search", count: data.featureAdoption.webSearch, color: "#FFD93D" },
            { label: "Web Fetch", count: data.featureAdoption.webFetch, color: "#FF8B3D" },
          ].map((feat) => (
            <div key={feat.label} className="border-[2px] border-border p-3 text-center">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">{feat.label}</p>
              <p className="mt-1 font-mono text-xl font-black" style={{ color: feat.color }}>
                {feat.count}
              </p>
              <p className="font-mono text-[10px] text-text-muted">
                {pct(feat.count, data.featureAdoption.total)} of sessions
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      {data.recentSessions.length > 0 && (
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
            Recent Sessions
            <span className="ml-2 font-mono text-xs font-normal text-text-muted">
              (last {data.recentSessions.length})
            </span>
          </h3>
          <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto" data-testid="recent-sessions">
            {data.recentSessions.map((session) => (
              <div
                key={session.sessionId}
                className="border-[2px] border-border/60 p-3 transition-colors hover:border-border hover:bg-surface"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{session.project}</span>
                    <span className="font-mono text-[10px] text-text-muted">
                      {new Date(session.startTime).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className="border-[2px] border-border px-2 py-0.5 font-display text-[9px] font-bold uppercase"
                    style={{ backgroundColor: outcomeBadgeColor(session.outcome), color: "#000" }}
                  >
                    {session.outcome.replace(/_/g, " ")}
                  </span>
                </div>
                {session.firstPrompt && (
                  <p className="mt-1 font-body text-xs text-text-muted line-clamp-1">{session.firstPrompt}</p>
                )}
                {session.briefSummary && (
                  <p className="mt-1 font-body text-xs text-text-light/70 line-clamp-2">{session.briefSummary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
