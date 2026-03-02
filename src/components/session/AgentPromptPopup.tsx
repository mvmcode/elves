/* AgentPromptPopup — prominent centered popup for agent follow-up questions.
 * Classifies the question as yes/no or text input and shows the appropriate UI.
 * Replaces the embedded FollowUpCard with a more visible, elf-branded experience. */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { MarkdownLite } from "@/lib/markdown-lite";
import { playSound } from "@/lib/sounds";
import { ElfAvatar, getAvatarId } from "@/components/theater/ElfAvatar";
import type { PromptType } from "@/lib/prompt-classifier";
import type { Elf } from "@/types/elf";

/** Quirky button label pairs for yes/no prompts: [affirmative, negative]. */
const BUTTON_PAIRS: readonly [string, string][] = [
  ["Do it!", "Nope!"],
  ["Make it so!", "Hard pass!"],
  ["Let's gooo!", "Not today!"],
  ["Ship it!", "Skip it!"],
  ["Absolutely!", "Hold up!"],
  ["Yes please!", "Nah."],
  ["Proceed!", "Abort!"],
];

interface AgentPromptPopupProps {
  readonly questionText: string;
  readonly promptType: PromptType;
  readonly leadElf: Elf | null;
  readonly onSubmit: (message: string) => void;
  readonly onDismiss: () => void;
  readonly onOpenTerminal: () => void;
  readonly isSubmitting: boolean;
}

/** Picks a random element from an array. */
function randomPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/**
 * Centered popup that appears when an agent asks a follow-up question.
 * Shows quirky yes/no buttons for binary questions, or a text input for open-ended ones.
 * Includes elf identity in the header and a "Go Super Mode" terminal link.
 */
export function AgentPromptPopup({
  questionText,
  promptType,
  leadElf,
  onSubmit,
  onDismiss,
  onOpenTerminal,
  isSubmitting,
}: AgentPromptPopupProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [buttonPair] = useState<[string, string]>(() => randomPick(BUTTON_PAIRS));

  const elfName = leadElf?.name ?? "Spark";
  const avatarId = getAvatarId(elfName);
  const elfColor = leadElf?.color ?? "#FFD93D";

  /* Play chat sound and auto-focus input on mount */
  useEffect(() => {
    playSound("chat");
    if (promptType === "text_input") {
      inputRef.current?.focus();
    }
  }, [promptType]);

  const handleTextSubmit = useCallback((): void => {
    const trimmed = message.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    setMessage("");
  }, [message, isSubmitting, onSubmit]);

  const handleYes = useCallback((): void => {
    if (isSubmitting) return;
    onSubmit("Yes, please proceed.");
  }, [isSubmitting, onSubmit]);

  const handleNo = useCallback((): void => {
    if (isSubmitting) return;
    onSubmit("No, do not do that.");
  }, [isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleTextSubmit();
      }
      if (event.key === "Escape") {
        onDismiss();
      }
    },
    [handleTextSubmit, onDismiss],
  );

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute bottom-20 left-1/2 z-20 w-[480px] -translate-x-1/2 border-[3px] border-border bg-white shadow-brutal-lg"
      data-testid="agent-prompt-popup"
    >
      {/* Elf header */}
      <div className="flex items-center gap-2 bg-elf-gold px-4 py-2">
        <ElfAvatar avatarId={avatarId} status="chatting" size="sm" color={elfColor} />
        <p
          className="font-display text-xs font-bold uppercase tracking-widest text-black"
          data-testid="prompt-elf-name"
        >
          {elfName} is asking...
        </p>
      </div>

      {/* Question body */}
      <div className="px-4 pt-3">
        <div className="max-h-48 overflow-y-auto border-[2px] border-dashed border-purple-300/40 bg-purple-50/10 px-3 py-2">
          <MarkdownLite
            text={questionText}
            className="font-body text-sm text-text-light/90 [&_pre]:text-[11px] [&_code]:text-[11px] [&_p]:leading-relaxed"
          />
        </div>
      </div>

      {/* Action area */}
      <div className="px-4 pb-3 pt-3">
        {promptType === "yes_no" ? (
          /* Yes/No buttons */
          <div className="flex items-center justify-center gap-3" data-testid="yes-no-buttons">
            <button
              onClick={handleYes}
              disabled={isSubmitting}
              className={[
                "border-[2px] border-border px-5 py-2 font-display text-xs font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100",
                isSubmitting
                  ? "cursor-not-allowed bg-gray-200 text-gray-400"
                  : "cursor-pointer bg-success text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
              ].join(" ")}
              data-testid="prompt-yes-btn"
            >
              {buttonPair[0]}
            </button>
            <button
              onClick={handleNo}
              disabled={isSubmitting}
              className={[
                "border-[2px] border-border px-5 py-2 font-display text-xs font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100",
                isSubmitting
                  ? "cursor-not-allowed bg-gray-200 text-gray-400"
                  : "cursor-pointer bg-error/10 text-error hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
              ].join(" ")}
              data-testid="prompt-no-btn"
            >
              {buttonPair[1]}
            </button>
          </div>
        ) : (
          /* Text input */
          <div className="flex items-center gap-2" data-testid="text-input-area">
            <input
              ref={inputRef}
              value={message}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply..."
              disabled={isSubmitting}
              className="flex-1 border-[2px] border-border bg-white px-3 py-2 font-body text-sm outline-none focus:shadow-[3px_3px_0px_0px_#FFD93D]"
              data-testid="prompt-text-input"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!message.trim() || isSubmitting}
              className={[
                "border-[2px] border-border px-4 py-2 font-display text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100",
                message.trim() && !isSubmitting
                  ? "cursor-pointer bg-info text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  : "cursor-not-allowed bg-gray-200 text-gray-400",
              ].join(" ")}
              data-testid="prompt-send-btn"
            >
              {isSubmitting ? "..." : "SEND"}
            </button>
          </div>
        )}
      </div>

      {/* Footer: Dismiss + Go Super Mode */}
      <div className="flex items-center gap-3 border-t-[2px] border-border/20 px-4 py-2">
        <button
          onClick={onDismiss}
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-[10px] text-text-light/40 underline hover:text-text-light/70"
          data-testid="prompt-dismiss"
        >
          Dismiss
        </button>
        <span className="text-text-light/20">·</span>
        <button
          onClick={onOpenTerminal}
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-[10px] text-info underline hover:text-info/80"
          data-testid="prompt-super-mode"
        >
          Go Super Mode ↗
        </button>
      </div>
    </motion.div>
  );
}
