/* SkillListItem — individual skill entry in the sidebar skill list. */

import type { Skill } from "@/types/skill";
import type { SkillSearchResultV2Item } from "@/types/skill-registry";

/** Props for a skill list item — supports both full Skill objects and V2 search result items. */
interface SkillListItemProps {
  readonly skill: Skill | SkillSearchResultV2Item;
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly onToggle?: (id: string, enabled: boolean) => Promise<void>;
}

/** Renders a single skill row in the sidebar list with name, description, and optional toggle. */
export function SkillListItem({ skill, isActive, onClick }: SkillListItemProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full border-b-token-thin border-border/10 px-3 py-3 text-left transition-all duration-100 rounded-token-sm",
        isActive
          ? "border-l-token-thick border-l-accent bg-accent-light"
          : "cursor-pointer hover:bg-accent-light/50",
      ].join(" ")}
      data-testid="skill-list-item"
    >
      <p className="font-body text-sm font-bold">{skill.name}</p>
      {skill.description && (
        <p className="mt-0.5 truncate font-body text-xs text-text-light/50">{skill.description}</p>
      )}
    </button>
  );
}
