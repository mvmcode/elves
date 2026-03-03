/* Prompt classifier — classifies agent question text as yes/no, multiple choice, or free-text input.
 * Pure function with no dependencies, used by InlineResponseBlock to pick the right UI. */

/** The three possible prompt types for agent follow-up questions. */
export type PromptType = "yes_no" | "multiple_choice" | "text_input";

/** Classification result with optional extracted options for multiple choice prompts. */
export interface PromptClassification {
  readonly type: PromptType;
  readonly options?: readonly string[];
}

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
 * Matches numbered list items in text: "1. Option", "2) Option", "(a) Option", "(1) Option".
 * Returns the extracted option labels if 2+ are found.
 */
function extractNumberedOptions(text: string): readonly string[] | null {
  /* Pattern for lines like: "1. Foo", "2) Bar", "(a) Baz", "(1) Qux" */
  const numberedPattern = /^\s*(?:\d+[.)]\s*|\([a-zA-Z0-9]+\)\s*)(.+)$/gm;
  const options: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = numberedPattern.exec(text)) !== null) {
    const label = match[1]?.trim();
    if (label) {
      options.push(label);
    }
  }

  return options.length >= 2 ? options : null;
}

/**
 * Classifies agent question text and returns a PromptClassification with type and
 * optional extracted options for multiple-choice prompts.
 *
 * Rules (evaluated in order):
 * 1. Multiple `?` marks → text_input (multi-question = open-ended)
 * 2. Contains 2+ numbered options (1. 2. 3. or (a) (b) patterns) → multiple_choice
 * 3. Contains open-ended starters (what, which, how, where, why, describe, please provide/specify) → text_input
 * 4. Contains yes/no starters (would you like, shall i, should i, etc.) → yes_no
 * 5. Short single-clause sentence ending in `?` (<=100 chars, no commas) → yes_no
 * 6. Default fallback → text_input
 */
export function classifyPromptType(text: string): PromptClassification {
  if (!text.trim()) return { type: "text_input" };

  /* Only scan the last ~300 chars for classification. */
  const tail = text.slice(-300);

  /* Rule 1: Multiple question marks → open-ended multi-question */
  const questionMarkCount = (tail.match(/\?/g) ?? []).length;
  if (questionMarkCount > 1) return { type: "text_input" };

  /* Rule 2: Numbered options → multiple_choice */
  const options = extractNumberedOptions(text);
  if (options) return { type: "multiple_choice", options };

  /* Rule 3: Open-ended starters → text_input */
  for (const pattern of TEXT_INPUT_PATTERNS) {
    if (pattern.test(tail)) return { type: "text_input" };
  }

  /* Rule 4: Yes/no starters → yes_no */
  for (const pattern of YES_NO_PATTERNS) {
    if (pattern.test(tail)) return { type: "yes_no" };
  }

  /* Rule 5: Short single-clause question → yes_no */
  const trimmedTail = tail.trim();
  if (
    trimmedTail.endsWith("?") &&
    trimmedTail.length <= 100 &&
    !trimmedTail.includes(",")
  ) {
    return { type: "yes_no" };
  }

  /* Rule 6: Default → text_input */
  return { type: "text_input" };
}
