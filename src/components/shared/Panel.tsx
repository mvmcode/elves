/* Neo-brutalist panel — bordered section container for layout regions. */

import { type HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  readonly bordered?: boolean;
}

/**
 * Layout panel for structuring page regions. Uses thick borders to
 * visually separate content areas per neo-brutalist grid structure rules.
 */
export function Panel({
  bordered = true,
  className = "",
  children,
  ...props
}: PanelProps): React.JSX.Element {
  return (
    <div
      className={[
        "bg-white p-4",
        bordered ? "border-[3px] border-border" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
