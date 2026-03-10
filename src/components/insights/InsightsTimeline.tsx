/* InsightsTimeline — daily sessions bar chart and hour-of-day heatmap. */

import type { InsightsData } from "@/types/insights";
import { HeatmapChart } from "./charts/HeatmapChart";

interface InsightsTimelineProps {
  readonly data: InsightsData;
}

/** Timeline tab — daily sessions bar chart (SVG) and hourly heatmap. */
export function InsightsTimeline({ data }: InsightsTimelineProps): React.JSX.Element {
  const { dailySessions, hourlyDistribution } = data;
  const maxDaily = Math.max(...dailySessions.map((d) => d.count), 1);
  const barWidth = 6;
  const barGap = 2;
  const chartHeight = 120;
  const svgWidth = dailySessions.length * (barWidth + barGap);

  return (
    <div className="flex flex-col gap-6">
      {/* Daily sessions bar chart */}
      <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
          Daily Sessions
          <span className="ml-2 font-mono text-xs font-normal text-text-muted">
            (last {dailySessions.length} days)
          </span>
        </h3>
        {dailySessions.length > 0 ? (
          <div className="overflow-x-auto">
            <svg
              width={Math.max(svgWidth, 300)}
              height={chartHeight + 20}
              viewBox={`0 0 ${Math.max(svgWidth, 300)} ${chartHeight + 20}`}
              className="overflow-visible"
              data-testid="daily-chart"
            >
              {dailySessions.map((day, index) => {
                const x = index * (barWidth + barGap);
                const barHeight = (day.count / maxDaily) * chartHeight;
                const y = chartHeight - barHeight;

                return (
                  <g key={day.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill="#FFD93D"
                      stroke="#000"
                      strokeWidth="1"
                      rx="1"
                    />
                    {/* Show date label every 7th bar */}
                    {index % 7 === 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight + 14}
                        textAnchor="middle"
                        className="fill-current text-text-muted"
                        fontSize="7"
                        fontFamily="Inter, sans-serif"
                      >
                        {day.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <p className="py-8 text-center font-body text-sm text-text-muted">No daily session data available</p>
        )}
      </div>

      {/* Hour-of-day heatmap */}
      <div className="border-[3px] border-border bg-surface-elevated p-5 shadow-brutal">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Hour of Day</h3>
        <HeatmapChart data={hourlyDistribution} />
      </div>
    </div>
  );
}
