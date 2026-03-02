/* FollowUpCard — response prompt shown when Claude asks a question at session end.
 * Renders a neo-brutalist card with the question text, a text input, and send/dismiss actions. */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { playSound } from "@/lib/sounds";

interface FollowUpCardProps {
  readonly questionText: string | null;
  readonly onSubmit: (message: string) => void;
  readonly onDismiss: () => void;
  readonly isSubmitting: boolean;
}

/**
 * Interactive follow-up card shown when Claude's result contains a question.
 * Uses slide-up entrance and plays a chat sound on mount to draw attention.
 */
export function FollowUpCard({
  questionText,
  onSubmit,
  onDismiss,
  isSubmitting,
}: FollowUpCardProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* Play chat sound and auto-focus on mount */
  useEffect(() => {
    playSound("chat");
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback((): void => {
    const trimmed = message.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    setMessage("");
  }, [message, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      }
      if (event.key === "Escape") {
        onDismiss();
      }
    },
    [handleSubmit, onDismiss],
  );

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="border-[3px] border-border shadow-brutal-sm"
      data-testid="follow-up-card"
    >
      {/* Blue left accent border */}
      <div className="border-l-[4px] border-info p-3">
        {/* Header */}
        <p className="font-display text-xs font-bold uppercase tracking-widest text-info">
          Claude is asking...
        </p>

        {/* Question text */}
        {questionText && (
          <div className="mt-2 border-[2px] border-dashed border-purple-300/40 bg-purple-50/10 px-3 py-2">
            <p className="font-mono text-sm italic text-text-light/80">
              {questionText.length > 300 ? `${questionText.slice(0, 300)}...` : questionText}
            </p>
          </div>
        )}

        {/* Input row */}
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            value={message}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply..."
            disabled={isSubmitting}
            className="flex-1 border-[2px] border-border bg-white px-3 py-1.5 font-body text-sm outline-none focus:shadow-[3px_3px_0px_0px_#4D96FF]"
            data-testid="follow-up-input"
          />
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className={[
              "border-[2px] border-border px-4 py-1.5 font-display text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100",
              message.trim() && !isSubmitting
                ? "cursor-pointer bg-info text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                : "cursor-not-allowed bg-gray-200 text-gray-400",
            ].join(" ")}
            data-testid="follow-up-send"
          >
            {isSubmitting ? "..." : "SEND"}
          </button>
        </div>

        {/* Dismiss link */}
        <button
          onClick={onDismiss}
          className="mt-2 cursor-pointer border-none bg-transparent p-0 font-mono text-[10px] text-text-light/40 underline hover:text-text-light/70"
          data-testid="follow-up-dismiss"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  );
}
