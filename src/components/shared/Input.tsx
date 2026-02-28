/* Neo-brutalist text input — thick border, yellow focus shadow. */

import { type InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Neo-brutalist input with 3px border and yellow shadow on focus.
 * No border-radius by default (sharp corners per design system).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={[
          "w-full border-token-normal border-border bg-surface-elevated px-4 py-3 rounded-token-md",
          "font-body text-base text-text-light outline-none",
          "placeholder:text-text-light/40",
          "focus:focus-ring",
          className,
        ].join(" ")}
        {...props}
      />
    );
  },
);
