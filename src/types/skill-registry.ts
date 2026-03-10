/* Skill registry types — curated skill sources, catalog items, and update tracking. */

/** A curated skill repository source (e.g., a GitHub repo with Claude commands). */
export interface SkillSource {
  readonly id: string;
  readonly repoUrl: string;
  readonly repoName: string;
  readonly description: string | null;
  readonly stars: number;
  readonly lastFetchedAt: number | null;
  readonly itemCount: number;
}

/** A single skill file within a source repository. */
export interface SkillSourceItem {
  readonly id: string;
  readonly sourceId: string;
  readonly name: string;
  readonly description: string | null;
  readonly filePath: string;
  readonly content: string | null;
  readonly category: string | null;
  readonly lastUpdatedAt: number;
}

/** A flattened catalog skill item — combines source item fields with source metadata. */
export interface CatalogSkillItem {
  readonly id: string;
  readonly sourceId: string;
  readonly name: string;
  readonly description: string | null;
  readonly filePath: string;
  readonly content: string | null;
  readonly category: string | null;
  readonly lastUpdatedAt: number;
  readonly sourceRepoName: string;
  readonly sourceRepoUrl: string;
  readonly sourceStars: number;
}

/** Information about an available upstream update for an installed skill. */
export interface SkillUpdateInfo {
  readonly skillId: string;
  readonly skillName: string;
  readonly sourceItemId: string;
  readonly currentCommit: string | null;
  readonly latestCommit: string;
  readonly sourceRepoName: string;
}

/** Grouped search results from the V2 unified search. */
export interface SkillSearchResultV2 {
  readonly local: readonly SkillSearchResultV2Item[];
  readonly catalog: readonly SkillSearchResultV2Item[];
  readonly remote: readonly RemoteSkillResult[];
}

/** A single item in V2 search results (local or catalog). */
export interface SkillSearchResultV2Item {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly source: string;
}

/** A GitHub search result for skill repositories. */
export interface RemoteSkillResult {
  readonly repoName: string;
  readonly description: string;
  readonly url: string;
  readonly stars: number;
  readonly author: string;
}
