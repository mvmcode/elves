/* PermissionPopup — neo-brutalist modal for Claude permission requests detected in PTY output.
 * Renders centered over the workshop canvas when Claude asks "Allow <Tool>?".
 * User clicks Allow/Deny which writes "y\n" or "n\n" to PTY stdin. */

import { motion } from "framer-motion";
import type { DetectedPermission } from "@/lib/pty-agent-detector";

interface PermissionPopupProps {
  /** The permission request to display. */
  readonly permission: DetectedPermission;
  /** Called with "y" to allow or "n" to deny — parent writes to PTY. */
  readonly onRespond: (response: "y" | "n") => void;
}

/**
 * Centered permission popup with neo-brutalist styling.
 * Shows the tool name and action description with Allow/Deny buttons.
 * Uses framer-motion for a snappy spring entrance.
 */
export function PermissionPopup({ permission, onRespond }: PermissionPopupProps): React.JSX.Element {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="w-80 border-[3px] border-border bg-white p-5 shadow-brutal-lg"
      >
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl">&#128274;</span>
          <h3 className="font-display text-lg font-black uppercase tracking-wider">
            Permission Request
          </h3>
        </div>

        {/* Tool name */}
        <div className="mb-2 border-[2px] border-border/40 bg-surface-light px-3 py-2">
          <p className="font-display text-sm font-bold uppercase tracking-wider text-info">
            {permission.tool}
          </p>
          {permission.description && (
            <p className="mt-1 break-all font-mono text-xs text-text-light/70">
              {permission.description}
            </p>
          )}
        </div>

        <p className="mb-4 font-body text-xs text-text-light/60">
          Claude wants to use this tool. Allow it?
        </p>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onRespond("y")}
            className="flex-1 cursor-pointer border-[3px] border-border bg-success px-4 py-2 font-display text-sm font-bold uppercase tracking-widest text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Allow
          </button>
          <button
            onClick={() => onRespond("n")}
            className="flex-1 cursor-pointer border-[3px] border-border bg-error px-4 py-2 font-display text-sm font-bold uppercase tracking-widest text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Deny
          </button>
        </div>
      </motion.div>
    </div>
  );
}
