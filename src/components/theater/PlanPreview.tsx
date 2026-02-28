/* PlanPreview — card-based plan editor shown before deployment when the analyzer returns a team plan. */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import type { TaskPlan, RoleDef, TaskNode, TaskNodeStatus } from "@/types/session";
import type { Runtime } from "@/types/elf";
import { generateElf, getAvatar, getColor } from "@/lib/elf-names";

interface PlanPreviewProps {
  readonly plan: TaskPlan;
  readonly onDeploy: (plan: TaskPlan) => void;
  readonly onEdit?: (plan: TaskPlan) => void;
}

/** Assigns elf personalities to each role in the plan for preview display. */
function assignElfNames(roles: readonly RoleDef[]): readonly string[] {
  const usedNames: string[] = [];
  return roles.map(() => {
    const elf = generateElf(usedNames);
    usedNames.push(elf.name);
    return elf.name;
  });
}

/** Maps task node status to a fill color for the dependency dot visualization. */
const STATUS_DOT_COLOR: Record<TaskNodeStatus, string> = {
  pending: "#E5E7EB",
  active: "#FFD93D",
  done: "#6BCB77",
  error: "#FF6B6B",
};

/** Available runtimes for the per-agent dropdown. */
const RUNTIME_OPTIONS: readonly { value: Runtime; label: string }[] = [
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
];

/**
 * Editable plan preview card layout for team task deployments.
 * Renders each role as a neo-brutalist card with elf personality, editable focus text,
 * runtime picker, and remove/add controls. Shows a simple task dependency flow below.
 * Not rendered for solo tasks — the parent should skip this component when complexity !== "team".
 */
export function PlanPreview({
  plan,
  onDeploy,
  onEdit,
}: PlanPreviewProps): React.JSX.Element {
  const [editedPlan, setEditedPlan] = useState<TaskPlan>({ ...plan });
  const [elfNames] = useState<readonly string[]>(() => assignElfNames(plan.roles));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  /** Starts inline editing for a role's focus text. */
  const handleStartEdit = useCallback((index: number, currentFocus: string): void => {
    setEditingIndex(index);
    setEditValue(currentFocus);
  }, []);

  /** Commits inline edit for role focus text. */
  const handleCommitEdit = useCallback((index: number): void => {
    const updatedRoles = editedPlan.roles.map((role, i) =>
      i === index ? { ...role, focus: editValue } : role
    );
    setEditedPlan({ ...editedPlan, roles: updatedRoles });
    setEditingIndex(null);
    setEditValue("");
  }, [editedPlan, editValue]);

  /** Removes a role from the plan by index. */
  const handleRemoveRole = useCallback((index: number): void => {
    const updatedRoles = editedPlan.roles.filter((_, i) => i !== index);
    setEditedPlan({
      ...editedPlan,
      roles: updatedRoles,
      agentCount: updatedRoles.length,
    });
  }, [editedPlan]);

  /** Adds a new blank role card to the plan. */
  const handleAddRole = useCallback((): void => {
    const newRole: RoleDef = {
      name: `Agent ${editedPlan.roles.length + 1}`,
      focus: "New task focus",
      runtime: "claude-code",
    };
    const updatedRoles = [...editedPlan.roles, newRole];
    setEditedPlan({
      ...editedPlan,
      roles: updatedRoles,
      agentCount: updatedRoles.length,
    });
  }, [editedPlan]);

  /** Updates the runtime for a specific role. */
  const handleRuntimeChange = useCallback((index: number, runtime: Runtime): void => {
    const updatedRoles = editedPlan.roles.map((role, i) =>
      i === index ? { ...role, runtime } : role
    );
    setEditedPlan({ ...editedPlan, roles: updatedRoles });
  }, [editedPlan]);

  /** Fires the deploy callback with the current (possibly edited) plan. */
  const handleDeploy = useCallback((): void => {
    onDeploy(editedPlan);
  }, [onDeploy, editedPlan]);

  /** Fires the edit callback with the current plan. */
  const handleEdit = useCallback((): void => {
    onEdit?.(editedPlan);
  }, [onEdit, editedPlan]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col gap-6 p-6"
      data-testid="plan-preview"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl text-heading">
          Deployment Plan
        </h2>
        <div className="flex items-center gap-3">
          <Badge variant="info">{editedPlan.agentCount} Agents</Badge>
          <Badge>{editedPlan.estimatedDuration}</Badge>
        </div>
      </div>

      {/* Runtime recommendation */}
      <p className="font-body text-sm text-text-muted" data-testid="runtime-recommendation">
        Recommended runtime: <strong>{editedPlan.runtimeRecommendation}</strong>
      </p>

      {/* Role cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="role-cards">
        <AnimatePresence mode="popLayout">
          {editedPlan.roles.map((role, index) => {
            const elfName = elfNames[index] ?? `Elf ${index + 1}`;
            const avatar = getAvatar(elfName);
            const color = getColor(elfName);

            return (
              <motion.div
                key={`role-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, x: -20 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="relative border-token-normal border-border bg-surface-elevated p-5 shadow-brutal rounded-token-md"
                style={{ borderTopWidth: "4px", borderTopColor: color }}
                data-testid="role-card"
              >
                {/* Remove button */}
                {editedPlan.roles.length > 1 && (
                  <button
                    onClick={() => handleRemoveRole(index)}
                    className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center border-token-thin border-border bg-error font-bold text-white transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                    style={{ boxShadow: "2px 2px 0px 0px #000" }}
                    aria-label={`Remove ${role.name}`}
                    data-testid="remove-role"
                  >
                    X
                  </button>
                )}

                {/* Elf identity */}
                <div className="flex items-center gap-2">
                  <span className="text-2xl" role="img" aria-label={`${elfName} avatar`}>
                    {avatar}
                  </span>
                  <div>
                    <span className="font-display text-base text-heading">
                      {elfName}
                    </span>
                    <p className="font-body text-xs text-text-muted-light">{role.name}</p>
                  </div>
                </div>

                {/* Editable focus text */}
                <div className="mt-3" data-testid="role-focus">
                  {editingIndex === index ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onBlur={() => handleCommitEdit(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleCommitEdit(index);
                        if (event.key === "Escape") setEditingIndex(null);
                      }}
                      className="w-full border-token-thin border-border bg-accent-light px-2 py-1 font-body text-sm outline-none focus:focus-ring"
                      data-testid="role-focus-input"
                      autoFocus
                    />
                  ) : (
                    <p
                      onClick={() => handleStartEdit(index, role.focus)}
                      className="cursor-pointer font-body text-sm text-text-muted hover:bg-accent-light hover:px-2 hover:py-1"
                      title="Click to edit"
                      data-testid="role-focus-text"
                    >
                      {role.focus}
                    </p>
                  )}
                </div>

                {/* Runtime picker */}
                <div className="mt-3">
                  <select
                    value={role.runtime}
                    onChange={(event) => handleRuntimeChange(index, event.target.value as Runtime)}
                    className="w-full border-token-thin border-border bg-surface-elevated px-2 py-1 font-body text-xs text-label outline-none rounded-token-sm"
                    data-testid="runtime-select"
                  >
                    {RUNTIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add role card */}
        <motion.button
          onClick={handleAddRole}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex min-h-[160px] cursor-pointer items-center justify-center border-token-normal border-dashed border-border bg-surface-light p-5 font-display text-2xl font-bold text-gray-400 transition-all duration-100 hover:border-solid hover:bg-accent-light hover:text-text-light hover:shadow-brutal rounded-token-md"
          data-testid="add-role"
        >
          + Add Agent
        </motion.button>
      </div>

      {/* Task dependency flow visualization */}
      {editedPlan.taskGraph.length > 0 && (
        <div className="mt-2" data-testid="task-flow">
          <h3 className="mb-3 font-display text-sm text-label text-text-muted-light">
            Task Flow
          </h3>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {editedPlan.taskGraph.map((node: TaskNode, index: number) => (
              <div key={node.id} className="flex items-center gap-2">
                {/* Node dot with label */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="h-6 w-6 border-token-thin border-border"
                    style={{
                      backgroundColor: STATUS_DOT_COLOR[node.status],
                      borderRadius: "50%",
                    }}
                    title={`${node.label} (${node.status})`}
                    data-testid="task-flow-dot"
                  />
                  <span className="max-w-[80px] truncate font-mono text-[10px] text-text-muted">
                    {node.label}
                  </span>
                </div>
                {/* Arrow connector between nodes */}
                {index < editedPlan.taskGraph.length - 1 && (
                  <div className="flex items-center" data-testid="task-flow-arrow">
                    <div className="h-[2px] w-6 bg-border" />
                    <div
                      className="border-y-[4px] border-l-[6px] border-y-transparent border-l-border"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-4 pt-2" data-testid="plan-actions">
        {onEdit && (
          <Button variant="secondary" onClick={handleEdit} data-testid="edit-plan-button">
            Edit Plan
          </Button>
        )}
        <Button
          variant="primary"
          className="px-8 py-4 font-display text-lg tracking-widest"
          onClick={handleDeploy}
          data-testid="deploy-button"
        >
          Summon the Elves
        </Button>
      </div>
    </motion.div>
  );
}
