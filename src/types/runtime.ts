/* Runtime types — detection results for Claude Code and Codex CLI availability. */

/** Version information for a detected runtime binary */
export interface RuntimeVersion {
  readonly version: string;
  readonly path: string;
}

/** Combined runtime detection results */
export interface RuntimeInfo {
  readonly claudeCode: RuntimeVersion | null;
  readonly codex: RuntimeVersion | null;
}
