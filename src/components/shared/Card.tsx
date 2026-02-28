/* Neo-brutalist card — thick border, hard drop shadow, solid background. */

import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly highlight?: boolean;
}

/**
 * Neo-brutalist card container with 3px border and 6px hard shadow.
 * Use highlight=true for a gold-accented card (e.g., active elf cards).
 */
export function Card({
  highlight = false,
  className = "",
  children,
  ...props
}: CardProps): React.JSX.Element {
  return (
    <div
      className={[
        "border-token-normal border-border p-5 shadow-brutal-lg rounded-token-md",
        highlight ? "bg-accent-light" : "bg-surface-elevated",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
