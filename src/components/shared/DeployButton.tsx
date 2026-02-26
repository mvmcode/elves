/* The SUMMON THE ELVES button — the primary action trigger. */

import { Button } from "./Button";
import type { ButtonHTMLAttributes } from "react";

type DeployButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
>;

/**
 * Oversized primary action button. This is the star CTA of the entire app.
 * Uses the primary (gold) variant with larger padding and bold text.
 */
export function DeployButton(props: DeployButtonProps): React.JSX.Element {
  return (
    <Button
      variant="primary"
      className="px-8 py-4 font-display text-lg tracking-widest"
      {...props}
    >
      SUMMON THE ELVES
    </Button>
  );
}
