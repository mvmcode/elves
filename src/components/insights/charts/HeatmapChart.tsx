/* HeatmapChart — 24-cell hour-of-day heatmap showing session frequency per hour.
 * Color intensity scales with the count relative to the peak hour. */

interface HeatmapChartProps {
  /** Array of 24 counts, one per hour (index 0 = midnight, 23 = 11pm). */
  readonly data: readonly number[];
  /** Base color for the heatmap cells (CSS color). */
  readonly color?: string;
}

/** Hour labels for the x-axis. */
const HOUR_LABELS = ["12a", "", "", "3a", "", "", "6a", "", "", "9a", "", "", "12p", "", "", "3p", "", "", "6p", "", "", "9p", "", ""];

/** 24-cell hour-of-day heatmap — no library, pure SVG. */
export function HeatmapChart({ data, color = "#FFD93D" }: HeatmapChartProps): React.JSX.Element {
  const maxCount = Math.max(...data, 1);
  const cellSize = 14;
  const cellGap = 2;
  const totalWidth = 24 * (cellSize + cellGap);
  const labelHeight = 16;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${totalWidth} ${cellSize + labelHeight + 4}`}
      preserveAspectRatio="xMinYMin meet"
      className="overflow-visible"
    >
      {data.map((count, hour) => {
        const x = hour * (cellSize + cellGap);
        const opacity = count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0.05;

        return (
          <g key={hour}>
            {/* Cell */}
            <rect
              x={x}
              y={0}
              width={cellSize}
              height={cellSize}
              fill={color}
              opacity={opacity}
              stroke="#000"
              strokeWidth="1.5"
              rx="2"
            />

            {/* Count inside cell (only if non-zero and cell is large enough) */}
            {count > 0 && (
              <text
                x={x + cellSize / 2}
                y={cellSize / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fill="#000"
              >
                {count}
              </text>
            )}

            {/* Hour label */}
            {HOUR_LABELS[hour] && (
              <text
                x={x + cellSize / 2}
                y={cellSize + labelHeight}
                textAnchor="middle"
                className="fill-current text-text-muted"
                fontSize="8"
                fontFamily="Inter, sans-serif"
              >
                {HOUR_LABELS[hour]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
