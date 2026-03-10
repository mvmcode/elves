/* XTerminal — React wrapper around xterm.js with WebGL-accelerated rendering and neo-brutalist theming. */

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";

/** Debounce delay in milliseconds for resize fitting. */
const RESIZE_DEBOUNCE_MS = 100;

/** Delay before attempting WebGL context recovery after GPU context loss. */
const WEBGL_RECOVERY_DELAY_MS = 2000;

/** Methods exposed to parent via ref for writing data to the terminal. */
export interface XTerminalHandle {
  /** Write raw data (from PTY output) into the terminal display. */
  write: (data: string) => void;
  /** Write a styled system message (e.g. "Session ended"). */
  writeln: (line: string) => void;
  /** Search for text in the terminal scrollback. Returns whether a match was found. */
  search: (query: string) => boolean;
  /** Clear the current search highlighting. */
  clearSearch: () => void;
  /** Scroll the terminal viewport to the bottom and re-attach to live output. */
  scrollToBottom: () => void;
  /** Clear the terminal scrollback and viewport. */
  clear: () => void;
  /** Get the currently selected text in the terminal. */
  getSelection: () => string;
}

interface XTerminalProps {
  /** Called when the user types in the terminal (raw key data for PTY stdin). */
  readonly onData: (data: string) => void;
  /** Called when the terminal viewport is resized (cols/rows for PTY resize). */
  readonly onResize: (cols: number, rows: number) => void;
}

/**
 * Mounts an xterm.js Terminal instance with GPU-accelerated WebGL rendering.
 * Handles lifecycle (create → fit → dispose), debounced ResizeObserver for auto-fit,
 * WebGL rendering with context loss recovery, scroll-to-bottom tracking,
 * and wires onData/onResize callbacks for the parent to bridge to a PTY.
 *
 * Addons loaded:
 * - WebGL: GPU-accelerated text rendering (falls back to canvas if unavailable)
 * - FitAddon: auto-resize terminal to container dimensions
 * - WebLinksAddon: clickable URLs in terminal output
 * - SearchAddon: find text in scrollback buffer
 * - Unicode11Addon: extended unicode/emoji support
 *
 * Theme matches the neo-brutalist dark palette: #1A1A2E background, #FFFDF7 text,
 * JetBrains Mono font, cursor blinking.
 */
export const XTerminal = forwardRef<XTerminalHandle, XTerminalProps>(
  function XTerminal({ onData, onResize }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const webglRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    /** Expose write/writeln/search/scrollToBottom to parent via ref. */
    useImperativeHandle(ref, () => ({
      write(data: string): void {
        terminalRef.current?.write(data);
      },
      writeln(line: string): void {
        terminalRef.current?.writeln(line);
      },
      search(query: string): boolean {
        return searchAddonRef.current?.findNext(query) ?? false;
      },
      clearSearch(): void {
        searchAddonRef.current?.clearDecorations();
      },
      scrollToBottom(): void {
        terminalRef.current?.scrollToBottom();
        setIsAtBottom(true);
      },
      clear(): void {
        terminalRef.current?.clear();
      },
      getSelection(): string {
        return terminalRef.current?.getSelection() ?? "";
      },
    }), []);

    /** Fit the terminal to its container. Skips zero-dimension containers. */
    const fit = useCallback((): void => {
      if (fitAddonRef.current && containerRef.current) {
        if (containerRef.current.offsetWidth <= 0 || containerRef.current.offsetHeight <= 0) {
          return;
        }
        try {
          fitAddonRef.current.fit();
        } catch {
          /* FitAddon can throw if container dimensions change mid-fit */
        }
      }
    }, []);

    /**
     * Debounced fit — waits for RESIZE_DEBOUNCE_MS of inactivity before fitting.
     * Uses requestAnimationFrame after the debounce for smooth visual update.
     * This prevents excessive fit()/onResize IPC calls during rapid panel dragging.
     */
    const scheduleFit = useCallback((): void => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        requestAnimationFrame(() => {
          fit();
        });
      }, RESIZE_DEBOUNCE_MS);
    }, [fit]);

    /** Handle scroll-to-bottom button click. */
    const handleScrollToBottom = useCallback((): void => {
      terminalRef.current?.scrollToBottom();
      setIsAtBottom(true);
    }, []);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const terminal = new Terminal({
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 10000,
        fastScrollSensitivity: 5,
        smoothScrollDuration: 0,
        theme: {
          background: "#1A1A2E",
          foreground: "#FFFDF7",
          cursor: "#FFD93D",
          selectionBackground: "#FFD93D40",
          black: "#1A1A2E",
          red: "#FF6B6B",
          green: "#6BCB77",
          yellow: "#FFD93D",
          blue: "#4D96FF",
          magenta: "#E0C3FC",
          cyan: "#4DD4AC",
          white: "#FFFDF7",
          brightBlack: "#4A4A6A",
          brightRed: "#FF8B8B",
          brightGreen: "#8BDB97",
          brightYellow: "#FFE76D",
          brightBlue: "#7DB6FF",
          brightMagenta: "#F0D3FF",
          brightCyan: "#7DE4CC",
          brightWhite: "#FFFFFF",
        },
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();
      const unicode11Addon = new Unicode11Addon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddon);
      terminal.loadAddon(unicode11Addon);
      terminal.unicode.activeVersion = "11";
      terminal.open(container);

      /* GPU-accelerated rendering with context loss recovery */
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          console.warn("[XTerminal] WebGL context lost, falling back to canvas");
          webglAddon.dispose();
          /* Attempt recovery after GPU stabilizes (lid close/open, display sleep) */
          webglRecoveryTimerRef.current = setTimeout(() => {
            webglRecoveryTimerRef.current = null;
            try {
              const recoveryAddon = new WebglAddon();
              recoveryAddon.onContextLoss(() => {
                recoveryAddon.dispose(); /* One retry only — stay on canvas after second loss */
              });
              terminal.loadAddon(recoveryAddon);
            } catch {
              /* WebGL still unavailable — stay on canvas renderer */
            }
          }, WEBGL_RECOVERY_DELAY_MS);
        });
        terminal.loadAddon(webglAddon);
      } catch {
        /* WebGL not available in this environment, canvas renderer is fine */
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      /* Initial fit after DOM paint */
      requestAnimationFrame(() => {
        fit();
        onResize(terminal.cols, terminal.rows);
      });

      /* Wire user input → parent callback (→ PTY stdin) */
      const dataDisposable = terminal.onData(onData);

      /* Wire terminal resize → parent callback (→ PTY resize) */
      const resizeDisposable = terminal.onResize(({ cols, rows }) => {
        onResize(cols, rows);
      });

      /* Track scroll position to show/hide scroll-to-bottom button */
      const scrollDisposable = terminal.onScroll(() => {
        const buffer = terminal.buffer.active;
        const isScrolledToBottom = buffer.viewportY >= buffer.baseY;
        setIsAtBottom(isScrolledToBottom);
      });

      /* Auto-fit on container resize — debounced to avoid rapid re-fits */
      const resizeObserver = new ResizeObserver(() => {
        scheduleFit();
      });
      resizeObserver.observe(container);

      /* Re-fit when container transitions from hidden to visible */
      const intersectionObserver = new IntersectionObserver(([entry]) => {
        if (entry && entry.intersectionRatio > 0) {
          scheduleFit();
        }
      });
      intersectionObserver.observe(container);

      /* Re-fit after minimize/restore or tab switch */
      const handleVisibilityChange = (): void => {
        if (document.visibilityState === "visible") {
          scheduleFit();
        }
      };
      const handleWindowFocus = (): void => {
        scheduleFit();
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleWindowFocus);

      return () => {
        /* Clear debounce and WebGL recovery timers to prevent leaks */
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        if (webglRecoveryTimerRef.current !== null) {
          clearTimeout(webglRecoveryTimerRef.current);
          webglRecoveryTimerRef.current = null;
        }
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleWindowFocus);
        dataDisposable.dispose();
        resizeDisposable.dispose();
        scrollDisposable.dispose();
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
        searchAddonRef.current = null;
      };
    }, [onData, onResize, fit, scheduleFit]);

    return (
      <div className="relative h-full w-full" data-testid="xterminal-wrapper">
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{ backgroundColor: "#1A1A2E" }}
          data-testid="xterminal-container"
        />
        {!isAtBottom && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            aria-label="Scroll to bottom — new output available"
            data-testid="scroll-to-bottom"
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              background: "#FFD93D",
              color: "#000000",
              border: "3px solid #000000",
              boxShadow: "4px 4px 0px 0px #000000",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              padding: "6px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              zIndex: 10,
              transition: "transform 0.1s ease-out, box-shadow 0.1s ease-out",
            }}
            onMouseEnter={(event) => {
              const target = event.currentTarget;
              target.style.transform = "translate(2px, 2px)";
              target.style.boxShadow = "2px 2px 0px 0px #000000";
            }}
            onMouseLeave={(event) => {
              const target = event.currentTarget;
              target.style.transform = "translate(0, 0)";
              target.style.boxShadow = "4px 4px 0px 0px #000000";
            }}
            onMouseDown={(event) => {
              const target = event.currentTarget;
              target.style.transform = "translate(4px, 4px)";
              target.style.boxShadow = "0px 0px 0px 0px #000000";
            }}
            onMouseUp={(event) => {
              const target = event.currentTarget;
              target.style.transform = "translate(2px, 2px)";
              target.style.boxShadow = "2px 2px 0px 0px #000000";
            }}
          >
            <span aria-hidden="true">&#8595;</span>
            New output
          </button>
        )}
      </div>
    );
  },
);
