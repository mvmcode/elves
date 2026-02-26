/* Memory types — defines the persistent memory system for cross-session context. */

/** Categories for memory entries. */
export type MemoryCategory =
  | "context"
  | "decision"
  | "learning"
  | "preference"
  | "fact";

/** Sort options for memory queries. */
export type MemorySortBy = "relevance" | "recency";

/** A single memory entry stored in the local database. */
export interface MemoryEntry {
  readonly id: number;
  readonly projectId: string | null;
  readonly category: MemoryCategory;
  readonly content: string;
  readonly source: string | null;
  readonly tags: string;
  readonly createdAt: number;
  readonly accessedAt: number;
  readonly relevanceScore: number;
}

/** Query parameters for filtering memories. */
export interface MemoryQuery {
  readonly category?: MemoryCategory;
  readonly keyword?: string;
  readonly minRelevance?: number;
  readonly limit?: number;
  readonly sortBy?: MemorySortBy;
}

/** Parameters for creating a new memory entry (without id/timestamps/score). */
export interface NewMemory {
  readonly projectId: string | null;
  readonly category: MemoryCategory;
  readonly content: string;
  readonly source?: string;
  readonly tags?: readonly string[];
}

/** Result returned by the post-session memory extraction heuristic. */
export interface ExtractionResult {
  readonly memories: readonly MemoryEntry[];
  readonly sessionSummary: string;
  readonly eventsProcessed: number;
}
