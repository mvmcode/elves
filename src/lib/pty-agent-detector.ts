/* PTY agent detector — scans raw terminal output for Claude Code Agent tool calls.
 * Strips ANSI escape codes, buffers lines, and detects when Claude spawns sub-agents
 * via the Agent tool in interactive PTY mode. Used to create corresponding elves. */

/** A newly detected agent from PTY output. */
export interface DetectedAgent {
  /** Unique key for deduplication (sequential counter). */
  readonly id: string;
  /** Extracted description of the agent's task, or a generic fallback. */
  readonly description: string;
  /** Extracted role/type (e.g., "Explore", "general-purpose"), or "Agent". */
  readonly role: string;
}

/** A permission request detected from PTY output (Claude asking for user approval). */
export interface DetectedPermission {
  /** Unique key for deduplication. */
  readonly id: string;
  /** The tool name Claude is requesting permission for (e.g., "Edit", "Bash"). */
  readonly tool: string;
  /** Description of the action (e.g., file path or command). */
  readonly description: string;
}

/** Result from feeding a PTY chunk — may contain agents and/or permission requests. */
export interface FeedResult {
  readonly agents: readonly DetectedAgent[];
  readonly permissions: readonly DetectedPermission[];
}

/**
 * Strip ANSI escape sequences from terminal output.
 * Handles CSI sequences (\x1b[...X), OSC sequences (\x1b]...ST), and single-char escapes.
 */
export function stripAnsi(text: string): string {
  return text
    /* CSI sequences: \x1b[ followed by params and a letter */
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
    /* OSC sequences: \x1b] ... (terminated by BEL \x07 or ST \x1b\\) */
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    /* Other escape sequences: \x1b followed by a single char */
    .replace(/\x1b[^[]\S?/g, "")
    /* Carriage returns (terminal cursor resets) */
    .replace(/\r/g, "");
}

/**
 * Patterns that indicate Claude Code is spawning a new agent via the Agent tool.
 * Matched against ANSI-stripped, trimmed lines.
 */
const AGENT_SPAWN_PATTERNS: readonly RegExp[] = [
  /* Agent tool header — Claude Code renders tool calls with the tool name */
  /(?:^|\s)Agent\s+tool\b/i,
  /* Bordered tool header: ─── Agent ─── or similar */
  /[─—]+\s*Agent\s*[─—]+/,
  /* Spinner/icon prefix: ⏳ Agent, ⌛ Agent, etc. */
  /^[⏳⌛🔄⚡]\s*Agent\b/,
  /* Explicit spawning messages */
  /(?:Spawning|Launching|Starting)\s+(?:a\s+)?(?:new\s+)?agent\b/i,
  /* "Use the Agent tool" or "Calling Agent tool" */
  /(?:Using|Calling|Invoking)\s+(?:the\s+)?Agent\s+tool/i,
  /* Agent SDK team spawning: "Spawning teammate" */
  /(?:Spawning|Launching|Creating)\s+(?:a\s+)?teammate\b/i,
  /* Agent (type) — e.g., Agent (Explore), Agent (general-purpose) */
  /\bAgent\s*\(\s*\w[\w-]*\s*\)/,
];

/**
 * Patterns to extract the agent role/type from a line.
 * Capture group 1 contains the role string.
 */
const ROLE_EXTRACTION_PATTERNS: readonly RegExp[] = [
  /* Agent (RoleName) */
  /\bAgent\s*\(\s*([\w-]+)\s*\)/i,
  /* subagent_type: "value" or subagent_type: value */
  /subagent_type[:\s]+["']?([\w-]+)["']?/i,
  /* Explicit role label */
  /(?:role|type)[:\s]+["']?([\w-]+)["']?/i,
];

/**
 * Patterns to extract the agent description from nearby lines.
 * Capture group 1 contains the description string.
 */
const DESC_EXTRACTION_PATTERNS: readonly RegExp[] = [
  /* description: "text" */
  /description[:\s]+["']([^"'\n]{5,120})["']/i,
  /* prompt: "text" */
  /prompt[:\s]+["']([^"'\n]{5,120})["']/i,
  /* "Launching agent to <description>" */
  /(?:Launching|Spawning|Starting)\s+(?:a\s+)?(?:new\s+)?agent\s+(?:to\s+)?(.{5,120})/i,
];

/**
 * Patterns that match Claude Code permission prompts in PTY output.
 * Claude renders these as: "Allow <ToolName>? (Y)es/(N)o/..." or
 * "Allow Bash("npm test")? (Y)es/(N)o/(A)lways/(D)eny always"
 */
const PERMISSION_PATTERNS: readonly RegExp[] = [
  /* Standard permission prompt: Allow ToolName? or Allow ToolName("...") */
  /Allow\s+([\w]+)(?:\("([^"]*)"\))?\s*\?/,
  /* Variant with parenthesized details: Allow ToolName(arg)? */
  /Allow\s+([\w]+)\(([^)]*)\)\s*\?/,
];

/**
 * Stateful detector that scans raw PTY output for Claude Code Agent tool invocations.
 * Maintains a line buffer across chunks (PTY output arrives in arbitrary-sized chunks
 * that can split lines). When an Agent tool call is detected, returns a DetectedAgent.
 *
 * Usage:
 * ```ts
 * const detector = new PtyAgentDetector();
 * ptyDataListener((chunk) => {
 *   const agents = detector.feed(chunk);
 *   for (const agent of agents) createElf(agent);
 * });
 * ```
 */
export class PtyAgentDetector {
  private lineBuffer = "";
  private agentCount = 0;
  private permissionCount = 0;
  /** Lines surrounding the current detection — used for description extraction. */
  private recentLines: string[] = [];
  /** Maximum recent lines to keep for context extraction. */
  private static readonly CONTEXT_WINDOW = 5;

  /**
   * Feed a raw PTY output chunk. Returns detected agents and permission requests
   * found in this chunk (empty arrays if nothing detected).
   */
  feed(rawChunk: string): FeedResult {
    const stripped = stripAnsi(rawChunk);
    this.lineBuffer += stripped;

    const agents: DetectedAgent[] = [];
    const permissions: DetectedPermission[] = [];
    const lines = this.lineBuffer.split("\n");
    /* Keep the last (possibly incomplete) line in the buffer */
    this.lineBuffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      /* Maintain a sliding window of recent lines for context */
      this.recentLines.push(line);
      if (this.recentLines.length > PtyAgentDetector.CONTEXT_WINDOW) {
        this.recentLines.shift();
      }

      /* Check for agent spawns */
      const isSpawn = AGENT_SPAWN_PATTERNS.some((pattern) => pattern.test(line));
      if (isSpawn) {
        this.agentCount++;
        const role = this.extractRole(line);
        const description = this.extractDescription(line);

        agents.push({
          id: `pty-agent-${this.agentCount}`,
          description,
          role,
        });
      }

      /* Check for permission requests */
      const permMatch = this.matchPermission(line);
      if (permMatch) {
        this.permissionCount++;
        permissions.push({
          id: `pty-perm-${this.permissionCount}`,
          tool: permMatch.tool,
          description: permMatch.description,
        });
      }
    }

    return { agents, permissions };
  }

  /** Reset all internal state. Call when switching PTY sessions. */
  reset(): void {
    this.lineBuffer = "";
    this.agentCount = 0;
    this.permissionCount = 0;
    this.recentLines = [];
  }

  /** Returns the total number of agents detected so far. */
  get totalDetected(): number {
    return this.agentCount;
  }

  /** Extract an agent role from the line, falling back to "Agent". */
  private extractRole(line: string): string {
    for (const pattern of ROLE_EXTRACTION_PATTERNS) {
      const match = pattern.exec(line);
      if (match?.[1]) return match[1];
    }
    /* Also check recent context lines */
    for (const contextLine of this.recentLines) {
      for (const pattern of ROLE_EXTRACTION_PATTERNS) {
        const match = pattern.exec(contextLine);
        if (match?.[1]) return match[1];
      }
    }
    return "Agent";
  }

  /** Extract a description from the line or recent context, falling back to a generic one. */
  private extractDescription(line: string): string {
    for (const pattern of DESC_EXTRACTION_PATTERNS) {
      const match = pattern.exec(line);
      if (match?.[1]) return match[1].trim();
    }
    /* Check recent context lines */
    for (const contextLine of this.recentLines) {
      for (const pattern of DESC_EXTRACTION_PATTERNS) {
        const match = pattern.exec(contextLine);
        if (match?.[1]) return match[1].trim();
      }
    }
    return `Agent task #${this.agentCount}`;
  }

  /** Match a permission request line, returning tool name and description if found. */
  private matchPermission(line: string): { tool: string; description: string } | null {
    for (const pattern of PERMISSION_PATTERNS) {
      const match = pattern.exec(line);
      if (match?.[1]) {
        return {
          tool: match[1],
          description: match[2] ?? "",
        };
      }
    }
    return null;
  }
}
