/* InsightsAnalysis — outcome distribution, tool/language/goal/friction breakdowns. */

import type { InsightsData } from "@/types/insights";
import { BarChart } from "./charts/BarChart";

interface InsightsAnalysisProps {
  readonly data: InsightsData;
}

/** Color map for common outcome types. */
const OUTCOME_COLORS: Record<string, string> = {
  success: "#6BCB77",
  partial: "#FFD93D",
  failure: "#FF6B6B",
  abandoned: "#FF8B3D",
};

/** Analysis tab — outcome distribution + top tools/languages/goals/friction charts. */
export function InsightsAnalysis({ data }: InsightsAnalysisProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      {/* Outcome distribution */}
      <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Outcome Distribution</h3>
        {data.outcomes.length > 0 ? (
          <div className="flex flex-col gap-2">
            {data.outcomes.map((entry) => {
              const color = OUTCOME_COLORS[entry.outcome.toLowerCase()] ?? "#4D96FF";
              return (
                <div key={entry.outcome} className="flex items-center gap-3">
                  <span className="w-24 font-mono text-xs font-bold capitalize">{entry.outcome}</span>
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

      {/* Two-column grid for breakdowns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top tools */}
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Top Tools</h3>
          <BarChart items={data.topTools} color="#4D96FF" />
        </div>

        {/* Top languages */}
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Top Languages</h3>
          <BarChart items={data.topLanguages} color="#6BCB77" />
        </div>

        {/* Top goals */}
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Top Goals</h3>
          <BarChart items={data.topGoals} color="#FFD93D" />
        </div>

        {/* Friction points */}
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Friction Points</h3>
          <BarChart items={data.topFriction} color="#FF6B6B" />
        </div>
      </div>
    </div>
  );
}
