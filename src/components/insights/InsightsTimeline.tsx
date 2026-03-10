/* InsightsTimeline — daily sessions/messages bar charts and hour-of-day heatmap. */

import type { InsightsData } from "@/types/insights";
import { HeatmapChart } from "./charts/HeatmapChart";

interface InsightsTimelineProps {
  readonly data: InsightsData;
}

/** Render an SVG bar chart from an array of { label, value } pairs. */
function DailyBarChart({
  entries,
  label,
  color,
  testId,
}: {
  readonly entries: readonly { label: string; value: number }[];
  readonly label: string;
  readonly color: string;
  readonly testId: string;
}): React.JSX.Element {
  const maxVal = Math.max(...entries.map((e) => e.value), 1);
  const barWidth = 6;
  const barGap = 2;
  const chartHeight = 120;
  const svgWidth = entries.length * (barWidth + barGap);

  return (
    <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
        {label}
        <span className="ml-2 font-mono text-xs font-normal text-text-muted">
          (last {entries.length} days)
        </span>
      </h3>
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <svg
            width={Math.max(svgWidth, 300)}
            height={chartHeight + 20}
            viewBox={`0 0 ${Math.max(svgWidth, 300)} ${chartHeight + 20}`}
            className="overflow-visible"
            data-testid={testId}
          >
            {entries.map((entry, index) => {
              const x = index * (barWidth + barGap);
              const barHeight = (entry.value / maxVal) * chartHeight;
              const y = chartHeight - barHeight;

              return (
                <g key={entry.label}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={color}
                    stroke="#000"
                    strokeWidth="1"
                    rx="1"
                  />
                  {index % 7 === 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 14}
                      textAnchor="middle"
                      className="fill-current text-text-muted"
                      fontSize="7"
                      fontFamily="Inter, sans-serif"
                    >
                      {entry.label.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p className="py-8 text-center font-body text-sm text-text-muted">No data available</p>
      )}
    </div>
  );
}

/** Timeline tab — daily sessions, daily messages, hourly heatmap. */
export function InsightsTimeline({ data }: InsightsTimelineProps): React.JSX.Element {
  const { dailyActivity, hourlyDistribution } = data;

  const sessionEntries = dailyActivity.map((d) => ({
    label: d.date,
    value: d.sessionCount,
  }));

  const messageEntries = dailyActivity.map((d) => ({
    label: d.date,
    value: d.messageCount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <DailyBarChart
        entries={sessionEntries}
        label="Daily Sessions"
        color="#FFD93D"
        testId="daily-sessions-chart"
      />

      <DailyBarChart
        entries={messageEntries}
        label="Daily Messages"
        color="#4D96FF"
        testId="daily-messages-chart"
      />

      {/* Hour-of-day heatmap */}
      <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Hour of Day</h3>
        <HeatmapChart data={hourlyDistribution} />
      </div>
    </div>
  );
}
