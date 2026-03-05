/* Search result types — returned by the Rust search commands that query npm registry and GitHub. */

/** A single MCP server result from an npm registry search. */
export interface McpSearchResult {
  readonly name: string;
  readonly description: string;
  readonly command: string;
  readonly args: string[];
  readonly env?: Record<string, string>;
  readonly sourceUrl: string | null;
  readonly author: string | null;
  /** Weekly npm download count, used for popularity ranking. */
  readonly downloads: number | null;
}

/** A single skill result from a GitHub repository search. */
export interface SkillSearchResult {
  readonly name: string;
  readonly description: string;
  readonly installUrl: string | null;
  readonly author: string | null;
  readonly content: string | null;
  readonly category: string | null;
  /** GitHub star count, used for popularity ranking. */
  readonly stars: number | null;
}
