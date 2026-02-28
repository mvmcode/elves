/* Task bar option pickers — agent, model, and permission mode dropdowns for Claude Code. */

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app";
import type { ClaudeAgent, ClaudeModel, PermissionMode } from "@/types/claude";

/** Renders the four option pickers: Agent, Model, Mode, and Team toggle. */
export function TaskBarPickers(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <AgentPicker />
      <ModelPicker />
      <ModePicker />
      <TeamToggle />
    </div>
  );
}

/** Compact neo-brutalist dropdown for selecting a custom agent. */
function AgentPicker(): React.JSX.Element {
  const claudeDiscovery = useAppStore((s) => s.claudeDiscovery);
  const selectedAgent = useAppStore((s) => s.selectedAgent);
  const setSelectedAgent = useAppStore((s) => s.setSelectedAgent);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const agents = claudeDiscovery?.agents ?? [];

  const handleSelect = useCallback(
    (agent: ClaudeAgent | null) => {
      setSelectedAgent(agent);
      // When selecting an agent with a preferred model, auto-set the model
      if (agent?.model) {
        setSelectedModel(agent.model as ClaudeModel);
      }
      setIsOpen(false);
    },
    [setSelectedAgent, setSelectedModel],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={[
          "flex cursor-pointer items-center gap-1 border-token-thin border-border rounded-token-sm px-2 py-1 font-mono text-xs font-bold transition-all duration-100",
          selectedAgent !== null
            ? "bg-info/20 shadow-[2px_2px_0px_0px_#000]"
            : "bg-surface-elevated hover:bg-surface-light",
        ].join(" ")}
      >
        <span className="text-[10px] text-label text-text-light/50">Agent:</span>
        <span className="max-w-[120px] truncate">
          {selectedAgent !== null ? selectedAgent.slug : "Default"}
        </span>
        <span className="text-[8px]">{isOpen ? "\u25B2" : "\u25BC"}</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] border-token-normal border-border bg-surface-elevated shadow-brutal-sm rounded-token-md">
          <DropdownItem
            label="Default"
            description="No custom agent"
            isSelected={selectedAgent === null}
            onClick={() => handleSelect(null)}
          />
          {agents.map((agent) => (
            <DropdownItem
              key={agent.slug}
              label={agent.slug}
              description={agent.description || "Custom agent"}
              badge={agent.model ?? undefined}
              isSelected={selectedAgent?.slug === agent.slug}
              onClick={() => handleSelect(agent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact neo-brutalist dropdown for selecting a Claude model. */
function ModelPicker(): React.JSX.Element {
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const claudeDiscovery = useAppStore((s) => s.claudeDiscovery);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const defaultModel = claudeDiscovery?.settings.defaultModel ?? "opus";

  const models: Array<{ value: ClaudeModel; label: string; description: string }> = [
    { value: "opus", label: "Opus", description: "Most capable, highest quality" },
    { value: "sonnet", label: "Sonnet", description: "Fast and capable" },
    { value: "haiku", label: "Haiku", description: "Fastest, most affordable" },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={[
          "flex cursor-pointer items-center gap-1 border-token-thin border-border rounded-token-sm px-2 py-1 font-mono text-xs font-bold transition-all duration-100",
          selectedModel !== null
            ? "bg-accent/30 shadow-[2px_2px_0px_0px_#000]"
            : "bg-surface-elevated hover:bg-surface-light",
        ].join(" ")}
      >
        <span className="text-[10px] text-label text-text-light/50">Model:</span>
        <span>{selectedModel ?? defaultModel}</span>
        <span className="text-[8px]">{isOpen ? "\u25B2" : "\u25BC"}</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] border-token-normal border-border bg-surface-elevated shadow-brutal-sm rounded-token-md">
          <DropdownItem
            label={`Default (${defaultModel})`}
            description="Use settings default"
            isSelected={selectedModel === null}
            onClick={() => {
              setSelectedModel(null);
              setIsOpen(false);
            }}
          />
          {models.map((m) => (
            <DropdownItem
              key={m.value}
              label={m.label}
              description={m.description}
              isSelected={selectedModel === m.value}
              onClick={() => {
                setSelectedModel(m.value);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact neo-brutalist dropdown for selecting a permission mode. */
function ModePicker(): React.JSX.Element {
  const selectedMode = useAppStore((s) => s.selectedPermissionMode);
  const setSelectedMode = useAppStore((s) => s.setSelectedPermissionMode);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const modes: Array<{ value: PermissionMode; label: string; description: string }> = [
    { value: "default", label: "Default", description: "Ask before risky actions" },
    { value: "acceptEdits", label: "Accept Edits", description: "Auto-approve file edits" },
    { value: "plan", label: "Plan", description: "Must approve plan first" },
    { value: "bypassPermissions", label: "YOLO", description: "Skip all permission checks" },
    { value: "dontAsk", label: "Don't Ask", description: "Never prompt for approval" },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={[
          "flex cursor-pointer items-center gap-1 border-token-thin border-border rounded-token-sm px-2 py-1 font-mono text-xs font-bold transition-all duration-100",
          selectedMode !== null
            ? "bg-success/20 shadow-[2px_2px_0px_0px_#000]"
            : "bg-surface-elevated hover:bg-surface-light",
        ].join(" ")}
      >
        <span className="text-[10px] text-label text-text-light/50">Mode:</span>
        <span>{modeDisplayName(selectedMode)}</span>
        <span className="text-[8px]">{isOpen ? "\u25B2" : "\u25BC"}</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] border-token-normal border-border bg-surface-elevated shadow-brutal-sm rounded-token-md">
          <DropdownItem
            label="Default"
            description="Use settings default"
            isSelected={selectedMode === null}
            onClick={() => {
              setSelectedMode(null);
              setIsOpen(false);
            }}
          />
          {modes.map((m) => (
            <DropdownItem
              key={m.value}
              label={m.label}
              description={m.description}
              isSelected={selectedMode === m.value}
              onClick={() => {
                setSelectedMode(m.value);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Checkbox-style toggle button to force team mode for the next task. */
function TeamToggle(): React.JSX.Element {
  const forceTeamMode = useAppStore((s) => s.forceTeamMode);
  const setForceTeamMode = useAppStore((s) => s.setForceTeamMode);

  return (
    <button
      onClick={() => setForceTeamMode(!forceTeamMode)}
      className={[
        "flex cursor-pointer items-center gap-1 border-token-thin border-border rounded-token-sm px-2 py-1 font-mono text-xs font-bold transition-all duration-100",
        forceTeamMode
          ? "bg-[#E0C3FC]/30 shadow-[2px_2px_0px_0px_#000]"
          : "bg-surface-elevated hover:bg-surface-light",
      ].join(" ")}
    >
      <span className="text-[10px] text-label text-text-light/50">Team:</span>
      <span>{forceTeamMode ? "ON" : "OFF"}</span>
    </button>
  );
}

/** Short display name for a permission mode (or "Default" if null). */
function modeDisplayName(mode: PermissionMode | null): string {
  if (mode === null) return "Default";
  switch (mode) {
    case "bypassPermissions":
      return "YOLO";
    case "acceptEdits":
      return "Accept Edits";
    case "dontAsk":
      return "Don't Ask";
    default:
      return mode.charAt(0).toUpperCase() + mode.slice(1);
  }
}

/** Reusable dropdown menu item with label, description, and optional badge. */
function DropdownItem(props: {
  readonly label: string;
  readonly description: string;
  readonly badge?: string;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      onClick={props.onClick}
      className={[
        "flex w-full cursor-pointer flex-col px-3 py-2 text-left transition-colors duration-75",
        props.isSelected
          ? "bg-accent/20 font-bold"
          : "hover:bg-surface-light",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold">{props.label}</span>
        {props.badge !== undefined && (
          <span className="border-[1.5px] border-border bg-accent/30 px-1 py-0 font-mono text-[9px] font-bold uppercase">
            {props.badge}
          </span>
        )}
        {props.isSelected && <span className="text-xs">&#10003;</span>}
      </div>
      <span className="text-[10px] leading-tight text-text-light/60">
        {props.description.length > 60
          ? props.description.slice(0, 57) + "..."
          : props.description}
      </span>
    </button>
  );
}

/** Close a dropdown when clicking outside its container ref. */
function useClickOutside(
  ref: React.RefObject<HTMLDivElement | null>,
  onClickOutside: () => void,
): void {
  useEffect(() => {
    function handleClick(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, onClickOutside]);
}
