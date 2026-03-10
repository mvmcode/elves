/* BarChart — reusable horizontal bar chart rendered as pure SVG.
 * Each bar shows a label on the left, a proportional fill, and a count on the right. */

import type { NamedCount } from "@/types/insights";

interface BarChartProps {
  /** Items to render as horizontal bars. */
  readonly items: readonly NamedCount[];
  /** Height of each bar row in pixels. */
  readonly barHeight?: number;
  /** Fill color for the bars. */
  readonly color?: string;
}

/** Horizontal bar chart — no library, pure SVG with neo-brutalist styling. */
export function BarChart({ items, barHeight = 28, color = "#FFD93D" }: BarChartProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center font-body text-sm text-text-muted">No data</p>
    );
  }

  const maxCount = Math.max(...items.map((item) => item.count), 1);
  const labelWidth = 120;
  const countWidth = 50;
  const gap = 4;
  const svgHeight = items.length * (barHeight + gap);

  return (
    <svg
      width="100%"
      viewBox={`0 0 400 ${svgHeight}`}
      preserveAspectRatio="xMinYMin meet"
      className="overflow-visible"
    >
      {items.map((item, index) => {
        const y = index * (barHeight + gap);
        const barAreaWidth = 400 - labelWidth - countWidth - 8;
        const fillWidth = (item.count / maxCount) * barAreaWidth;

        return (
          <g key={item.name}>
            {/* Label */}
            <text
              x={labelWidth - 4}
              y={y + barHeight / 2 + 1}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-current text-text-light"
              fontSize="11"
              fontFamily="Inter, sans-serif"
              fontWeight="600"
            >
              {item.name.length > 16 ? `${item.name.slice(0, 15)}…` : item.name}
            </text>

            {/* Bar background */}
            <rect
              x={labelWidth}
              y={y + 2}
              width={barAreaWidth}
              height={barHeight - 4}
              fill="currentColor"
              className="text-border/10"
              rx="2"
            />

            {/* Bar fill */}
            <rect
              x={labelWidth}
              y={y + 2}
              width={Math.max(fillWidth, 2)}
              height={barHeight - 4}
              fill={color}
              stroke="#000"
              strokeWidth="1.5"
              rx="2"
            />

            {/* Count */}
            <text
              x={400 - 4}
              y={y + barHeight / 2 + 1}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-current text-text-light"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
            >
              {item.count.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
