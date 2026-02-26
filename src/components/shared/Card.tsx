/* Neo-brutalist card — thick border, hard drop shadow, solid background. */

import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly highlight?: boolean;
}

/**
 * Neo-brutalist card container with 3px border and 6px hard shadow.
 * Use highlight=true for a yellow-accented card (e.g., active minion cards).
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
        "border-[3px] border-border p-5 shadow-brutal-lg",
        highlight ? "bg-minion-yellow-light" : "bg-white",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
