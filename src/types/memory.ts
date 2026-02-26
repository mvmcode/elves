/* Memory types — defines the persistent memory system for cross-session context. */

/** Categories for memory entries */
export type MemoryCategory =
  | "context"
  | "decision"
  | "learning"
  | "preference"
  | "fact";

/** A single memory entry stored in the local database */
export interface MemoryEntry {
  readonly id: number;
  readonly projectId: string | null;
  readonly category: MemoryCategory;
  readonly content: string;
  readonly source: string | null;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly accessedAt: number;
  readonly relevanceScore: number;
}
