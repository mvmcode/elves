/* ThinkingPanel — collapsible panel displaying lead agent's extended thinking with typewriter streaming. */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ThinkingPanelProps {
  readonly thoughts: readonly string[];
  readonly isVisible: boolean;
  readonly onToggle: () => void;
}

/** Speed of the typewriter effect — milliseconds between each character reveal. */
const TYPEWRITER_INTERVAL_MS = 10;

/** Number of characters revealed per tick for faster streaming feel. */
const CHARS_PER_TICK = 3;

/**
 * Collapsible panel that shows extended thinking/reasoning events from the lead agent.
 * Features a fast typewriter streaming effect for new text, neo-brutalist styling
 * with dashed border, monospace font, and dark background with reversed shadow.
 * Only renders during team tasks — parent should control isVisible based on session type.
 */
export function ThinkingPanel({
  thoughts,
  isVisible,
  onToggle,
}: ThinkingPanelProps): React.JSX.Element {
  const [displayedText, setDisplayedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetTextRef = useRef("");

  /** Join all thoughts into a single display string. */
  const fullText = thoughts.join("\n\n");

  /** Typewriter effect — reveals characters progressively when new text arrives. */
  useEffect(() => {
    if (fullText === targetTextRef.current) return;

    targetTextRef.current = fullText;
    const currentLength = displayedText.length;

    /* If new text is shorter (thoughts reset), jump immediately */
    if (fullText.length <= currentLength) {
      setDisplayedText(fullText);
      return;
    }

    setIsStreaming(true);
    let charIndex = currentLength;

    const interval = setInterval(() => {
      charIndex = Math.min(charIndex + CHARS_PER_TICK, fullText.length);
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        clearInterval(interval);
        setIsStreaming(false);
      }
    }, TYPEWRITER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fullText, displayedText.length]);

  /** Auto-scroll to bottom when new content streams in. */
  useEffect(() => {
    if (scrollRef.current && isVisible) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedText, isVisible]);

  return (
    <div data-testid="thinking-panel-container">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-2 border-[2px] border-border bg-surface-dark px-4 py-2 font-body text-sm font-bold text-text-dark shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        data-testid="thinking-toggle"
      >
        <span>{isVisible ? "Hide Thinking" : "Show Thinking"}</span>
        {isStreaming && (
          <span className="inline-block h-2 w-2 animate-pulse bg-elf-gold" data-testid="streaming-indicator" />
        )}
      </button>

      {/* Collapsible content */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="mt-2 max-h-64 overflow-y-auto border-[2px] border-dashed border-border bg-surface-dark p-4"
              style={{ boxShadow: "-4px -4px 0px 0px rgba(0,0,0,0.15)" }}
              data-testid="thinking-content"
            >
              {displayedText.length === 0 ? (
                <p className="font-mono text-sm text-gray-500" data-testid="thinking-empty">
                  Waiting for thinking events...
                </p>
              ) : (
                <pre
                  className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-dark"
                  data-testid="thinking-text"
                >
                  {displayedText}
                  {isStreaming && (
                    <span className="inline-block animate-pulse text-elf-gold" data-testid="cursor">
                      |
                    </span>
                  )}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
