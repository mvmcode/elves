/* ShipItDialog — modal for completing a workspace: merge strategy, memory extraction, and confirmation. */

import { useState, useCallback } from "react";
import { Dialog } from "@/components/shared/Dialog";
import type { WorkspaceInfo, MergeStrategy } from "@/types/workspace";

interface ShipItDialogProps {
  readonly isOpen: boolean;
  readonly workspace: WorkspaceInfo;
  readonly onClose: () => void;
  readonly onConfirm: (strategy: MergeStrategy, extractMemory: boolean) => void;
}

/** Describes what each merge strategy does for the user. */
const STRATEGY_DESCRIPTIONS: Record<MergeStrategy, string> = {
  merge: "Create a merge commit preserving full branch history.",
  rebase: "Replay commits on top of target branch for linear history.",
  squash: "Combine all commits into a single commit on target.",
};

/**
 * Confirmation dialog for the "Ship It" flow — push, merge, optionally extract memories,
 * and clean up the workspace. Shows workspace details, merge strategy selection,
 * and memory extraction toggle.
 */
export function ShipItDialog({
  isOpen,
  workspace,
  onClose,
  onConfirm,
}: ShipItDialogProps): React.JSX.Element {
  const [strategy, setStrategy] = useState<MergeStrategy>("squash");
  const [extractMemory, setExtractMemory] = useState(true);

  const handleConfirm = useCallback((): void => {
    onConfirm(strategy, extractMemory);
    onClose();
  }, [strategy, extractMemory, onConfirm, onClose]);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Ship It">
      <div className="flex flex-col gap-4">
        {/* Workspace summary */}
        <div className="border-[2px] border-border bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-display text-sm font-bold">{workspace.slug}</span>
            {workspace.elfName && (
              <span className="font-body text-xs text-text-muted">{workspace.elfName}</span>
            )}
          </div>
          <div className="font-mono text-xs text-text-muted">
            <span>{workspace.branch}</span>
            {workspace.filesChanged > 0 && (
              <span className="ml-2">
                {workspace.filesChanged} file{workspace.filesChanged !== 1 ? "s" : ""} changed
              </span>
            )}
          </div>
        </div>

        {/* Merge strategy radio buttons */}
        <div>
          <label className="mb-2 block font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            Merge Strategy
          </label>
          <div className="flex flex-col gap-2">
            {(["merge", "rebase", "squash"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setStrategy(option)}
                className={[
                  "flex cursor-pointer items-start gap-3 border-[2px] border-border p-3 text-left transition-all duration-100",
                  strategy === option
                    ? "bg-elf-gold/20 shadow-brutal-xs"
                    : "bg-white hover:bg-surface-elevated",
                ].join(" ")}
                data-testid={`strategy-${option}`}
              >
                <span
                  className={[
                    "mt-0.5 inline-block h-4 w-4 shrink-0 border-[2px] border-border",
                    strategy === option ? "bg-elf-gold" : "bg-white",
                  ].join(" ")}
                />
                <div>
                  <span className="font-display text-xs font-bold uppercase tracking-wider">
                    {option === "merge" ? "Merge Commit" : option === "rebase" ? "Rebase" : "Squash"}
                  </span>
                  <p className="mt-0.5 font-body text-xs text-text-muted">
                    {STRATEGY_DESCRIPTIONS[option]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Memory extraction toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExtractMemory(!extractMemory)}
            className={[
              "flex h-6 w-10 cursor-pointer items-center border-[2px] border-border p-0.5 transition-all duration-100",
              extractMemory ? "justify-end bg-success" : "justify-start bg-text-light/10",
            ].join(" ")}
            data-testid="extract-memory-toggle"
          >
            <span className="inline-block h-4 w-4 border-[2px] border-border bg-white" />
          </button>
          <span className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            Extract memories before cleanup
          </span>
        </div>

        {/* What will happen */}
        <div className="border-t-[2px] border-border/30 pt-3">
          <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-wider text-text-muted">
            This will:
          </p>
          <ul className="flex flex-col gap-1 font-mono text-xs text-text-muted">
            <li>1. Push branch to remote</li>
            <li>2. {strategy === "merge" ? "Merge" : strategy === "rebase" ? "Rebase" : "Squash merge"} into target branch</li>
            {extractMemory && <li>3. Extract session memories</li>}
            <li>{extractMemory ? "4" : "3"}. Clean up worktree and branch</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="cursor-pointer border-[2px] border-border bg-surface-elevated px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-text-muted shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="cursor-pointer border-[2px] border-border bg-success px-6 py-2 font-display text-sm font-bold uppercase tracking-wider text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            data-testid="confirm-shipit-btn"
          >
            Ship It
          </button>
        </div>
      </div>
    </Dialog>
  );
}
