/* Skill types — reusable prompt templates stored in the local database. */

/** A saved skill (prompt template) with metadata and trigger pattern. */
export interface Skill {
  readonly id: string;
  readonly projectId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly content: string;
  readonly triggerPattern: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Parameters for creating a new skill. */
export interface NewSkill {
  readonly projectId: string | null;
  readonly name: string;
  readonly description?: string;
  readonly content: string;
  readonly triggerPattern?: string;
}
