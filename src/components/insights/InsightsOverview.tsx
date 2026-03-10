/* InsightsOverview — stat cards grid and runtime split bars for the Overview tab. */

import type { InsightsData } from "@/types/insights";

interface InsightsOverviewProps {
  readonly data: InsightsData;
}

/** Format a number with locale separators. */
function fmt(value: number): string {
  return value.toLocaleString();
}

/** Format seconds into a human-readable duration (e.g., "3h 24m"). */
function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return remainMinutes > 0 ? `${hours}h ${remainMinutes}m` : `${hours}h`;
}

/** Format USD cost. */
function fmtCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/** A single stat card with label and value. */
function StatCard({ label, value, color }: { readonly label: string; readonly value: string; readonly color?: string }): React.JSX.Element {
  return (
    <div className="border-[3px] border-border bg-surface-elevated p-4 shadow-brutal" data-testid="stat-card">
      <p className="font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

/** Overview tab — 8 stat cards in a grid + runtime split bars. */
export function InsightsOverview({ data }: InsightsOverviewProps): React.JSX.Element {
  const totalRuntimeSessions = data.runtimeSplit.reduce((sum, r) => sum + r.sessions, 0) || 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards grid — 4 columns */}
      <div className="grid grid-cols-4 gap-3" data-testid="stat-grid">
        <StatCard label="Sessions" value={fmt(data.totalSessions)} color="#4D96FF" />
        <StatCard label="Tokens" value={fmt(data.totalTokens)} />
        <StatCard label="Cost" value={fmtCost(data.totalCost)} color="#FF6B6B" />
        <StatCard label="Duration" value={fmtDuration(data.totalDuration)} />
        <StatCard label="Commits" value={fmt(data.totalCommits)} color="#6BCB77" />
        <StatCard label="Lines +" value={fmt(data.linesAdded)} color="#6BCB77" />
        <StatCard label="Lines −" value={fmt(data.linesRemoved)} color="#FF6B6B" />
        <StatCard label="Files" value={fmt(data.filesChanged)} />
      </div>

      {/* Runtime split */}
      <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Runtime Split</h3>
        <div className="flex flex-col gap-2">
          {data.runtimeSplit.map((split) => {
            const pct = (split.sessions / totalRuntimeSessions) * 100;
            return (
              <div key={split.runtime} className="flex items-center gap-3">
                <span className="w-24 font-mono text-xs font-bold">{split.runtime}</span>
                <div className="relative h-6 flex-1 border-[2px] border-border bg-surface">
                  <div
                    className="h-full bg-elf-gold"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-xs font-bold">
                  {split.sessions} ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
          {data.runtimeSplit.length === 0 && (
            <p className="text-sm text-text-muted">No runtime data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
