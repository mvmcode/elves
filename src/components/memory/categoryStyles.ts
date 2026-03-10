/* Shared category style definitions for memory components. */

import type { MemoryCategory } from "@/types/memory";

interface CategoryStyle {
  /** Badge background class */
  readonly className: string;
  /** Human-readable label */
  readonly label: string;
  /** Bar segment color class for the distribution chart */
  readonly barColor: string;
}

/** Maps memory category to display styles used by MemoryCard and MemoryDashboard. */
export const CATEGORY_STYLES: Record<MemoryCategory, CategoryStyle> = {
  context: { className: "bg-info text-white", label: "Context", barColor: "bg-info" },
  decision: { className: "bg-elf-gold text-text-light", label: "Decision", barColor: "bg-elf-gold" },
  learning: { className: "bg-success text-white", label: "Learning", barColor: "bg-success" },
  preference: { className: "bg-[#C084FC] text-white", label: "Preference", barColor: "bg-[#C084FC]" },
  fact: { className: "bg-gray-400 text-white", label: "Fact", barColor: "bg-gray-400" },
};
