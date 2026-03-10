/* MCP server types — configured Model Context Protocol servers. */

/** Scope for an MCP server: global or project-specific. */
export type McpScope = "global" | "project";

/** A configured MCP server with connection details and health status. */
export interface McpServer {
  readonly id: string;
  readonly name: string;
  readonly command: string;
  readonly args: string;
  readonly env: string;
  readonly scope: McpScope;
  readonly enabled: boolean;
  readonly lastHealthCheck: number | null;
}

/** Parameters for adding a new MCP server. */
export interface NewMcpServer {
  readonly name: string;
  readonly command: string;
  readonly args?: string[];
  readonly env?: Record<string, string>;
  readonly scope?: McpScope;
}

/** A curated MCP server entry from the built-in catalog. */
export interface McpCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly command: string;
  readonly args: string[];
  readonly category: string;
  readonly sourceUrl: string | null;
  readonly envKeys: string[];
}

/** Result from importing MCP servers from Claude Code config files. */
export interface McpImportResult {
  readonly imported: number;
  readonly scanned: number;
}
