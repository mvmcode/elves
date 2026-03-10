/* Insights types — aggregated usage analytics from Claude Code telemetry files. */

/** A single day's activity from stats-cache. */
export interface DailyActivityEntry {
  readonly date: string;
  readonly sessionCount: number;
  readonly messageCount: number;
  readonly toolCallCount: number;
}

/** A named item with a numeric count, used for top-N bar charts. */
export interface NamedCount {
  readonly name: string;
  readonly count: number;
}

/** Outcome distribution entry (from facets analysis). */
export interface OutcomeEntry {
  readonly outcome: string;
  readonly count: number;
  readonly percentage: number;
}

/** Per-model token breakdown from stats-cache. */
export interface ModelUsageEntry {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheHitRate: number;
}

/** Per-project aggregated summary. */
export interface ProjectSummary {
  readonly name: string;
  readonly sessions: number;
  readonly linesAdded: number;
  readonly commits: number;
  readonly durationMinutes: number;
  readonly tokens: number;
}

/** Per-session summary for the recent sessions list. */
export interface SessionSummary {
  readonly sessionId: string;
  readonly project: string;
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly firstPrompt: string;
  readonly outcome: string;
  readonly briefSummary: string;
  readonly linesAdded: number;
  readonly tokens: number;
  readonly commits: number;
}

/** Feature adoption stats. */
export interface FeatureAdoption {
  readonly taskAgent: number;
  readonly mcp: number;
  readonly webSearch: number;
  readonly webFetch: number;
  readonly total: number;
}

/** Full aggregated insights data returned from the Rust backend. */
export interface InsightsData {
  /* KPIs */
  readonly totalSessions: number;
  readonly totalMessages: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalDurationMinutes: number;
  readonly totalCommits: number;
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly filesChanged: number;
  readonly firstSessionDate: string | null;

  /* Timeline */
  readonly dailyActivity: readonly DailyActivityEntry[];
  readonly hourlyDistribution: readonly number[];

  /* Models */
  readonly modelUsage: readonly ModelUsageEntry[];

  /* Projects */
  readonly projects: readonly ProjectSummary[];

  /* Quality */
  readonly outcomes: readonly OutcomeEntry[];
  readonly topHelpfulness: readonly NamedCount[];
  readonly topSatisfaction: readonly NamedCount[];
  readonly topFriction: readonly NamedCount[];
  readonly topGoals: readonly NamedCount[];
  readonly topSessionTypes: readonly NamedCount[];

  /* Tools */
  readonly topTools: readonly NamedCount[];
  readonly topLanguages: readonly NamedCount[];

  /* Features */
  readonly featureAdoption: FeatureAdoption;

  /* Sessions */
  readonly recentSessions: readonly SessionSummary[];

  /* Report */
  readonly reportHtml: string | null;
}
