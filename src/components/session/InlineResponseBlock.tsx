/* InlineResponseBlock — inline interactive block for agent follow-up questions.
 * Renders at the bottom of the theater area with yes/no, multiple choice, or text input modes. */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { MarkdownLite } from "@/lib/markdown-lite";
import { classifyPromptType } from "@/lib/prompt-classifier";
import { playSound } from "@/lib/sounds";
import { ElfAvatar, getAvatarId } from "@/components/theater/ElfAvatar";
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

interface InlineResponseBlockProps {
  readonly questionText: string;
  readonly leadElf: Elf | null;
  readonly onSubmit: (message: string) => void;
  readonly onDismiss: () => void;
  readonly isSubmitting: boolean;
}

/** Picks a random element from an array. */
function randomPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/**
 * Inline interactive block that appears at the bottom of the theater when
 * an agent asks a follow-up question. Classifies the question text and
 * renders yes/no buttons, multiple-choice option cards, or a text input.
 */
export function InlineResponseBlock({
  questionText,
  leadElf,
  onSubmit,
  onDismiss,
  isSubmitting,
}: InlineResponseBlockProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [buttonPair] = useState<[string, string]>(() => randomPick(BUTTON_PAIRS));

  const classification = classifyPromptType(questionText);
  const promptType = classification.type;
  const options = classification.options;

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

  const handleOptionSelect = useCallback((index: number, label: string): void => {
    if (isSubmitting) return;
    setSelectedOption(index);
    /* Small delay so user sees the selection highlight before submitting */
    setTimeout(() => {
      onSubmit(label);
    }, 150);
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

  /* Global Escape key listener for non-text-input modes */
  useEffect(() => {
    if (promptType === "text_input") return;
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onDismiss();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [promptType, onDismiss]);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="border-t-[3px] border-border bg-white"
      data-testid="inline-response-block"
    >
      {/* Elf header */}
      <div className="flex items-center gap-2 bg-elf-gold px-4 py-2">
        <ElfAvatar avatarId={avatarId} status="chatting" size="sm" color={elfColor} />
        <p
          className="font-display text-xs font-bold uppercase tracking-widest text-black"
          data-testid="inline-elf-name"
        >
          {elfName} is asking...
        </p>
        <button
          onClick={onDismiss}
          className="ml-auto cursor-pointer border-none bg-transparent p-0 font-mono text-xs font-bold text-black/40 hover:text-black"
          data-testid="inline-dismiss"
          title="Dismiss (Esc)"
        >
          ESC
        </button>
      </div>

      {/* Question body */}
      <div className="px-4 pt-3">
        <div className="max-h-36 overflow-y-auto border-[2px] border-dashed border-purple-300/40 bg-purple-50/10 px-3 py-2">
          <MarkdownLite
            text={questionText}
            className="font-body text-sm text-text-light/90 [&_pre]:text-[11px] [&_code]:text-[11px] [&_p]:leading-relaxed"
          />
        </div>
      </div>

      {/* Action area */}
      <div className="px-4 pb-3 pt-3">
        {promptType === "yes_no" && (
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
              data-testid="inline-yes-btn"
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
              data-testid="inline-no-btn"
            >
              {buttonPair[1]}
            </button>
          </div>
        )}

        {promptType === "multiple_choice" && options && (
          <div className="flex flex-col gap-2" data-testid="multiple-choice-options">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionSelect(index, option)}
                disabled={isSubmitting}
                className={[
                  "w-full border-[2px] border-border px-4 py-2 text-left font-body text-sm transition-all duration-100",
                  isSubmitting
                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                    : selectedOption === index
                      ? "bg-elf-gold font-bold shadow-none"
                      : "cursor-pointer bg-white shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                ].join(" ")}
                data-testid={`option-${index}`}
              >
                <span className="mr-2 font-display text-xs font-bold text-black/50">
                  {index + 1}.
                </span>
                {option}
              </button>
            ))}
          </div>
        )}

        {promptType === "text_input" && (
          <div className="flex items-center gap-2" data-testid="text-input-area">
            <input
              ref={inputRef}
              value={message}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply..."
              disabled={isSubmitting}
              className="flex-1 border-[2px] border-border bg-white px-3 py-2 font-body text-sm outline-none focus:shadow-[3px_3px_0px_0px_#FFD93D]"
              data-testid="inline-text-input"
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
              data-testid="inline-send-btn"
            >
              {isSubmitting ? "..." : "SEND"}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
