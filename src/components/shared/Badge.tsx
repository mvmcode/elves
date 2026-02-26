/* Neo-brutalist badge — compact label with thick border for status indicators. */

import { type HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "error" | "warning" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-minion-yellow text-text-light",
  success: "bg-success text-white",
  error: "bg-error text-white",
  warning: "bg-warning text-white",
  info: "bg-info text-white",
};

/**
 * Compact status badge with 2px border. Used for minion status indicators,
 * runtime labels, and count badges in the sidebar.
 */
export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={[
        "inline-block border-[2px] border-border px-2 py-0.5",
        "font-body text-xs font-bold uppercase tracking-wider",
        variantStyles[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
