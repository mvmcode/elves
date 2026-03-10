/* MemoryDashboard — stats, category distribution, and actionable insights computed from memory data. */

import { useMemo } from "react";
import { Card } from "@/components/shared/Card";
import { Badge } from "@/components/shared/Badge";
import type { MemoryEntry, MemoryCategory } from "@/types/memory";
import { CATEGORY_STYLES } from "./categoryStyles";

/** Threshold below which a memory is considered "fading". */
const FADING_THRESHOLD = 0.3;

/** Threshold above which average relevance is considered healthy. */
const HEALTHY_THRESHOLD = 0.7;

interface MemoryDashboardProps {
  /** All memory entries from the store */
  readonly memories: readonly MemoryEntry[];
  /** Callback to open the add-memory form with a pre-selected category */
  readonly onAddWithCategory?: (category: MemoryCategory) => void;
}

interface DashboardStats {
  readonly total: number;
  readonly pinned: number;
  readonly fading: number;
  readonly healthScore: number;
}

interface CategoryCount {
  readonly category: MemoryCategory;
  readonly count: number;
  readonly label: string;
  readonly colorClass: string;
}

interface Insight {
  readonly id: string;
  readonly color: "amber" | "blue" | "green" | "red";
  readonly message: string;
  readonly action?: { label: string; category: MemoryCategory };
}

/** Color dot classes for insight indicators. */
const INSIGHT_COLORS: Record<Insight["color"], string> = {
  amber: "bg-warning",
  blue: "bg-info",
  green: "bg-success",
  red: "bg-error",
};

/** Compute stats from the memory array. */
function computeStats(memories: readonly MemoryEntry[]): DashboardStats {
  const total = memories.length;
  const pinned = memories.filter((m) => m.source === "pinned").length;
  const fading = memories.filter((m) => m.relevanceScore < FADING_THRESHOLD).length;
  const healthScore =
    total > 0
      ? Math.round(
          (memories.reduce((sum, m) => sum + m.relevanceScore, 0) / total) * 100,
        )
      : 0;

  return { total, pinned, fading, healthScore };
}

/** Compute per-category counts for the distribution bar. */
function computeCategoryDistribution(
  memories: readonly MemoryEntry[],
): readonly CategoryCount[] {
  const ALL_CATEGORIES: readonly MemoryCategory[] = [
    "context",
    "decision",
    "learning",
    "preference",
    "fact",
  ];

  return ALL_CATEGORIES.map((category) => ({
    category,
    count: memories.filter((m) => m.category === category).length,
    label: CATEGORY_STYLES[category].label,
    colorClass: CATEGORY_STYLES[category].barColor,
  }));
}

/** Generate actionable insights based on memory state. */
function generateInsights(
  memories: readonly MemoryEntry[],
  stats: DashboardStats,
): readonly Insight[] {
  const insights: Insight[] = [];

  if (stats.total === 0) {
    insights.push({
      id: "empty",
      color: "blue",
      message: "Start a task to build memories",
    });
    return insights;
  }

  if (stats.fading > 0) {
    insights.push({
      id: "fading",
      color: "amber",
      message: `${stats.fading} ${stats.fading === 1 ? "memory" : "memories"} fading below 30% — pin the important ones`,
    });
  }

  const hasDecisions = memories.some((m) => m.category === "decision");
  if (!hasDecisions) {
    insights.push({
      id: "no-decisions",
      color: "blue",
      message: "No decisions recorded yet",
      action: { label: "Add Decision", category: "decision" },
    });
  }

  const hasPreferences = memories.some((m) => m.category === "preference");
  if (!hasPreferences) {
    insights.push({
      id: "no-preferences",
      color: "blue",
      message: "No preferences stored — your elves won't know your style",
      action: { label: "Add Preference", category: "preference" },
    });
  }

  const hasLearnings = memories.some((m) => m.category === "learning");
  if (!hasLearnings) {
    insights.push({
      id: "no-learnings",
      color: "blue",
      message: "No learnings captured — complete a session to build knowledge",
      action: { label: "Add Learning", category: "learning" },
    });
  }

  if (stats.pinned > 0) {
    insights.push({
      id: "pinned-strong",
      color: "green",
      message: `${stats.pinned} pinned ${stats.pinned === 1 ? "memory" : "memories"} keeping context strong`,
    });
  }

  /* "All healthy" insight only if average relevance > 70% and all categories present */
  if (
    insights.length === 0 ||
    (stats.healthScore > HEALTHY_THRESHOLD * 100 &&
      hasDecisions &&
      hasPreferences &&
      hasLearnings)
  ) {
    const alreadyHasHealthy = insights.some((i) => i.id === "all-healthy");
    if (!alreadyHasHealthy && stats.healthScore > HEALTHY_THRESHOLD * 100 && hasDecisions && hasPreferences && hasLearnings) {
      insights.push({
        id: "all-healthy",
        color: "green",
        message: "All memories healthy",
      });
    }
  }

  return insights;
}

/** Health score color based on percentage. */
function healthColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-error";
}

/**
 * Dashboard panel showing memory stats, category distribution bar, and actionable insights.
 * Renders above the memory card list in MemoryExplorer.
 */
export function MemoryDashboard({
  memories,
  onAddWithCategory,
}: MemoryDashboardProps): React.JSX.Element {
  const stats = useMemo(() => computeStats(memories), [memories]);
  const distribution = useMemo(
    () => computeCategoryDistribution(memories),
    [memories],
  );
  const insights = useMemo(
    () => generateInsights(memories, stats),
    [memories, stats],
  );

  return (
    <div className="flex flex-col gap-4" data-testid="memory-dashboard">
      {/* Stats Row */}
      <div
        className="grid grid-cols-4 gap-3"
        data-testid="dashboard-stats"
      >
        <Card className="flex flex-col items-center gap-1 p-4">
          <span
            className="font-display text-2xl font-bold text-heading"
            data-testid="stat-total-value"
          >
            {stats.total}
          </span>
          <Badge variant="info">Total</Badge>
        </Card>

        <Card className="flex flex-col items-center gap-1 p-4">
          <span
            className="font-display text-2xl font-bold text-heading"
            data-testid="stat-pinned-value"
          >
            {stats.pinned}
          </span>
          <Badge variant="default">Pinned</Badge>
        </Card>

        <Card className="flex flex-col items-center gap-1 p-4">
          <span
            className="font-display text-2xl font-bold text-heading"
            data-testid="stat-fading-value"
          >
            {stats.fading}
          </span>
          <Badge variant="warning">Fading</Badge>
        </Card>

        <Card className="flex flex-col items-center gap-1 p-4">
          <span
            className={[
              "font-display text-2xl font-bold",
              healthColor(stats.healthScore),
            ].join(" ")}
            data-testid="stat-health-value"
          >
            {stats.healthScore}%
          </span>
          <Badge
            variant={
              stats.healthScore >= 70
                ? "success"
                : stats.healthScore >= 40
                  ? "warning"
                  : "error"
            }
          >
            Health
          </Badge>
        </Card>
      </div>

      {/* Category Distribution Bar */}
      {stats.total > 0 && (
        <div data-testid="category-distribution">
          <div className="flex h-6 overflow-hidden border-token-normal border-border rounded-token-sm">
            {distribution.map((cat) => {
              const widthPercent =
                stats.total > 0 ? (cat.count / stats.total) * 100 : 0;
              if (widthPercent === 0) return null;
              return (
                <div
                  key={cat.category}
                  className={[cat.colorClass, "h-full"].join(" ")}
                  style={{ width: `${widthPercent}%` }}
                  title={`${cat.label}: ${cat.count}`}
                  data-testid={`dist-${cat.category}`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {distribution.map((cat) => (
              <span
                key={cat.category}
                className="flex items-center gap-1 font-body text-xs text-text-muted-light"
              >
                <span
                  className={[
                    "inline-block h-2.5 w-2.5 border border-border",
                    cat.colorClass,
                  ].join(" ")}
                />
                {cat.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Insights Panel */}
      {insights.length > 0 && (
        <div
          className="flex flex-col gap-2"
          data-testid="dashboard-insights"
        >
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="flex items-center gap-3 border-token-thin border-border bg-surface-elevated rounded-token-sm px-4 py-2.5"
              data-testid={`insight-${insight.id}`}
            >
              <span
                className={[
                  "inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border",
                  INSIGHT_COLORS[insight.color],
                ].join(" ")}
                data-testid="insight-dot"
              />
              <span className="flex-1 font-body text-sm text-text-light">
                {insight.message}
              </span>
              {insight.action && onAddWithCategory && (
                <button
                  onClick={() => onAddWithCategory(insight.action!.category)}
                  className="shrink-0 cursor-pointer border-token-thin border-border bg-accent rounded-token-sm px-3 py-1 font-body text-xs font-bold text-accent-contrast shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  data-testid={`insight-action-${insight.id}`}
                >
                  {insight.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Export computation functions for testing. */
export { computeStats, computeCategoryDistribution, generateInsights };
export type { DashboardStats, CategoryCount, Insight };
