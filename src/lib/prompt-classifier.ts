/* Prompt classifier — classifies agent question text as yes/no or free-text input.
 * Pure function with no dependencies, used by AgentPromptPopup to pick the right UI. */

/** The two possible prompt types for agent follow-up questions. */
export type PromptType = "yes_no" | "text_input";

/** Patterns that indicate the agent is asking permission to proceed (yes/no). */
const YES_NO_PATTERNS: readonly RegExp[] = [
  /would you like/i,
  /shall i/i,
  /should i/i,
  /do you want/i,
  /want me to/i,
  /can i proceed/i,
  /ok to/i,
  /proceed with/i,
  /go ahead/i,
  /ready to/i,
  /is that (?:ok|okay|correct|right)\??/i,
  /does that (?:work|sound good|look (?:good|right))\??/i,
];

/** Patterns that indicate an open-ended question requiring free-text. */
const TEXT_INPUT_PATTERNS: readonly RegExp[] = [
  /\bwhat\s/i,
  /\bwhich\s/i,
  /\bhow\s/i,
  /\bwhere\s/i,
  /\bwhy\s/i,
  /\bdescribe\s/i,
  /please provide/i,
  /please specify/i,
];

/**
 * Classifies agent question text as "yes_no" or "text_input" based on
 * keyword/pattern matching in the last ~300 characters of the text.
 *
 * Rules (evaluated in order):
 * 1. Multiple `?` marks → text_input (multi-question = open-ended)
 * 2. Contains open-ended starters (what, which, how, where, why, describe, please provide/specify) → text_input
 * 3. Contains yes/no starters (would you like, shall i, should i, etc.) → yes_no
 * 4. Short single-clause sentence ending in `?` (<=100 chars, no commas) → yes_no
 * 5. Default fallback → text_input
 */
export function classifyPromptType(text: string): PromptType {
  if (!text.trim()) return "text_input";

  /* Only scan the last ~300 chars for classification. */
  const tail = text.slice(-300);

  /* Rule 1: Multiple question marks → open-ended multi-question */
  const questionMarkCount = (tail.match(/\?/g) ?? []).length;
  if (questionMarkCount > 1) return "text_input";

  /* Rule 2: Open-ended starters → text_input */
  for (const pattern of TEXT_INPUT_PATTERNS) {
    if (pattern.test(tail)) return "text_input";
  }

  /* Rule 3: Yes/no starters → yes_no */
  for (const pattern of YES_NO_PATTERNS) {
    if (pattern.test(tail)) return "yes_no";
  }

  /* Rule 4: Short single-clause question → yes_no */
  const trimmedTail = tail.trim();
  if (
    trimmedTail.endsWith("?") &&
    trimmedTail.length <= 100 &&
    !trimmedTail.includes(",")
  ) {
    return "yes_no";
  }

  /* Rule 5: Default → text_input */
  return "text_input";
}
