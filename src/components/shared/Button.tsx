/* Neo-brutalist button — thick borders, hard shadow, snappy press animation. */

import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-elf-gold text-text-light",
  secondary: "bg-white text-text-light",
  danger: "bg-error text-white",
  ghost: "bg-transparent text-text-light border-transparent shadow-none",
};

/**
 * Neo-brutalist button with thick 3px border, hard drop shadow, and press animation.
 * Hover translates the element toward its shadow (pressing it in).
 * Active state flattens the shadow completely.
 */
export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={[
        "cursor-pointer border-[3px] border-border px-6 py-3",
        "font-body text-sm font-bold uppercase tracking-wider",
        "shadow-brutal transition-all duration-100 ease-out",
        "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm",
        "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
