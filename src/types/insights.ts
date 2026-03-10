/* Insights types — aggregated usage analytics from Claude Code telemetry and ELVES sessions. */

/** A single day's count for timeline charts. */
export interface DailyCount {
  readonly date: string;
  readonly count: number;
}

/** A named item with a numeric count, used for top-N bar charts. */
export interface NamedCount {
  readonly name: string;
  readonly count: number;
}

/** Runtime split — sessions and cost per runtime. */
export interface RuntimeSplit {
  readonly runtime: string;
  readonly sessions: number;
  readonly cost: number;
}

/** Outcome distribution entry (from facets analysis). */
export interface OutcomeEntry {
  readonly outcome: string;
  readonly count: number;
  readonly percentage: number;
}

/** Full aggregated insights data returned from the Rust backend in a single IPC call. */
export interface InsightsData {
  /** Total sessions across all sources. */
  readonly totalSessions: number;
  /** Total tokens consumed. */
  readonly totalTokens: number;
  /** Total estimated cost in USD. */
  readonly totalCost: number;
  /** Total duration in seconds across all sessions. */
  readonly totalDuration: number;
  /** Total git commits recorded. */
  readonly totalCommits: number;
  /** Total lines added. */
  readonly linesAdded: number;
  /** Total lines removed. */
  readonly linesRemoved: number;
  /** Total files touched. */
  readonly filesChanged: number;

  /** Sessions per day for the timeline chart (last 90 days). */
  readonly dailySessions: readonly DailyCount[];
  /** Sessions per hour-of-day (0-23) for the heatmap. */
  readonly hourlyDistribution: readonly number[];

  /** Cost and session count per runtime. */
  readonly runtimeSplit: readonly RuntimeSplit[];

  /** Outcome distribution from facets analysis. */
  readonly outcomes: readonly OutcomeEntry[];
  /** Top tools by usage count. */
  readonly topTools: readonly NamedCount[];
  /** Top programming languages by usage count. */
  readonly topLanguages: readonly NamedCount[];
  /** Top goal categories from facets. */
  readonly topGoals: readonly NamedCount[];
  /** Top friction points from facets. */
  readonly topFriction: readonly NamedCount[];
}
