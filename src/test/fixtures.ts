/* Shared test fixture factories. Provides zero-value defaults so tests only specify what they assert on. */

import type { InsightsData } from "@/types/insights";

/** Build an InsightsData object with all zeros/empty arrays. Override only what the test needs. */
export function insightsData(overrides: Partial<InsightsData> = {}): InsightsData {
  return {
    totalSessions: 0,
    totalMessages: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalDurationMinutes: 0,
    totalCommits: 0,
    linesAdded: 0,
    linesRemoved: 0,
    filesChanged: 0,
    firstSessionDate: null,
    dailyActivity: [],
    hourlyDistribution: Array.from({ length: 24 }, () => 0),
    modelUsage: [],
    projects: [],
    outcomes: [],
    topHelpfulness: [],
    topSatisfaction: [],
    topFriction: [],
    topGoals: [],
    topSessionTypes: [],
    topTools: [],
    topLanguages: [],
    featureAdoption: { taskAgent: 0, mcp: 0, webSearch: 0, webFetch: 0, total: 0 },
    recentSessions: [],
    reportHtml: null,
    ...overrides,
  };
}
