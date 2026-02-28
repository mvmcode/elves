/* Runtime control configuration — maps each runtime to its available models, approval modes, and feature flags. */

import type { Runtime } from "@/types/elf";

/** A selectable option with an id and display label. */
export interface RuntimeOption {
  readonly id: string;
  readonly label: string;
}

/** An approval mode option with an additional description for the dropdown. */
export interface ApprovalModeOption extends RuntimeOption {
  readonly description: string;
}

/** Feature flags and available controls for a specific runtime. */
export interface RuntimeControlConfig {
  readonly models: readonly RuntimeOption[];
  readonly approvalModes: readonly ApprovalModeOption[];
  readonly supportsCustomAgents: boolean;
  readonly supportsSkills: boolean;
  readonly supportsMcp: boolean;
  readonly contextFileName: string | null;
}

/** Registry of available controls per runtime. The frontend reads from this to populate pickers. */
export const RUNTIME_CONTROLS: Record<Runtime, RuntimeControlConfig> = {
  "claude-code": {
    models: [
      { id: "opus", label: "Opus" },
      { id: "sonnet", label: "Sonnet" },
      { id: "haiku", label: "Haiku" },
    ],
    approvalModes: [
      { id: "default", label: "Default", description: "Ask before risky actions" },
      { id: "acceptEdits", label: "Accept Edits", description: "Auto-approve file edits" },
      { id: "plan", label: "Plan", description: "Must approve plan first" },
      { id: "bypassPermissions", label: "YOLO", description: "Skip all permission checks" },
      { id: "dontAsk", label: "Don't Ask", description: "Never prompt for approval" },
    ],
    supportsCustomAgents: true,
    supportsSkills: true,
    supportsMcp: true,
    contextFileName: "CLAUDE.md",
  },
  codex: {
    models: [
      { id: "o4-mini", label: "o4-mini" },
      { id: "o3", label: "o3" },
      { id: "codex-mini", label: "Codex Mini" },
    ],
    approvalModes: [
      { id: "suggest", label: "Suggest", description: "Suggest changes, don't apply" },
      { id: "auto-edit", label: "Auto Edit", description: "Apply file edits automatically" },
      { id: "full-auto", label: "Full Auto", description: "Execute everything automatically" },
    ],
    supportsCustomAgents: false,
    supportsSkills: false,
    supportsMcp: false,
    contextFileName: "AGENTS.md",
  },
};

/** Returns the control configuration for the given runtime. */
export function getRuntimeControlConfig(runtime: Runtime): RuntimeControlConfig {
  return RUNTIME_CONTROLS[runtime];
}
