/* InsightsOverview — KPI grid, model usage breakdown, and project summary table. */

import type { InsightsData } from "@/types/insights";

interface InsightsOverviewProps {
  readonly data: InsightsData;
}

/** Format a number with locale separators. */
function fmt(value: number): string {
  return value.toLocaleString();
}

/** Format minutes into a human-readable duration (e.g., "124h 30m"). */
function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return remainMinutes > 0 ? `${hours}h ${remainMinutes}m` : `${hours}h`;
}

/** Format large token counts compactly (e.g., "1.2M", "456K"). */
function fmtTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
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

/** Overview tab — 9 KPI cards, model usage table, project summary table. */
export function InsightsOverview({ data }: InsightsOverviewProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI grid — 3×3 */}
      <div className="grid grid-cols-3 gap-3" data-testid="stat-grid">
        <StatCard label="Sessions" value={fmt(data.totalSessions)} color="#4D96FF" />
        <StatCard label="Messages" value={fmt(data.totalMessages)} color="#4D96FF" />
        <StatCard label="Duration" value={fmtDuration(data.totalDurationMinutes)} />
        <StatCard label="Input Tokens" value={fmtTokens(data.totalInputTokens)} />
        <StatCard label="Output Tokens" value={fmtTokens(data.totalOutputTokens)} />
        <StatCard label="Commits" value={fmt(data.totalCommits)} color="#6BCB77" />
        <StatCard label="Lines +" value={fmt(data.linesAdded)} color="#6BCB77" />
        <StatCard label="Lines −" value={fmt(data.linesRemoved)} color="#FF6B6B" />
        <StatCard label="Files" value={fmt(data.filesChanged)} />
      </div>

      {/* Model Usage */}
      {data.modelUsage.length > 0 && (
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Model Usage</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-[2px] border-border">
                  <th className="pb-2 font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Model</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Input</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Output</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Cache Read</th>
                  <th className="pb-2 font-display text-[10px] font-bold uppercase tracking-widest text-text-muted" style={{ width: 140 }}>Cache Hit</th>
                </tr>
              </thead>
              <tbody>
                {data.modelUsage.map((model) => (
                  <tr key={model.model} className="border-b border-border/30">
                    <td className="py-2 font-mono text-xs font-bold">{model.model}</td>
                    <td className="py-2 text-right font-mono text-xs">{fmtTokens(model.inputTokens)}</td>
                    <td className="py-2 text-right font-mono text-xs">{fmtTokens(model.outputTokens)}</td>
                    <td className="py-2 text-right font-mono text-xs">{fmtTokens(model.cacheReadTokens)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="relative h-3 flex-1 border-[2px] border-border bg-surface">
                          <div
                            className="h-full bg-elf-gold"
                            style={{ width: `${Math.min(model.cacheHitRate, 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[10px] font-bold">
                          {model.cacheHitRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Projects */}
      {data.projects.length > 0 && (
        <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Projects</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-[2px] border-border">
                  <th className="pb-2 font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Project</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Sessions</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Lines+</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Commits</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Duration</th>
                  <th className="pb-2 text-right font-display text-[10px] font-bold uppercase tracking-widest text-text-muted">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((project) => (
                  <tr key={project.name} className="border-b border-border/30">
                    <td className="py-2 font-mono text-xs font-bold">{project.name}</td>
                    <td className="py-2 text-right font-mono text-xs">{project.sessions}</td>
                    <td className="py-2 text-right font-mono text-xs">{fmt(project.linesAdded)}</td>
                    <td className="py-2 text-right font-mono text-xs">{project.commits}</td>
                    <td className="py-2 text-right font-mono text-xs">{fmtDuration(project.durationMinutes)}</td>
                    <td className="py-2 text-right font-mono text-xs">{fmtTokens(project.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
