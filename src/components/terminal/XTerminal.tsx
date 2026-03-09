/* XTerminal — React wrapper around xterm.js with auto-fit and neo-brutalist theming. */

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

/** Methods exposed to parent via ref for writing data to the terminal. */
export interface XTerminalHandle {
  /** Write raw data (from PTY output) into the terminal display. */
  write: (data: string) => void;
  /** Write a styled system message (e.g. "Session ended"). */
  writeln: (line: string) => void;
}

interface XTerminalProps {
  /** Called when the user types in the terminal (raw key data for PTY stdin). */
  readonly onData: (data: string) => void;
  /** Called when the terminal viewport is resized (cols/rows for PTY resize). */
  readonly onResize: (cols: number, rows: number) => void;
}

/**
 * Mounts an xterm.js Terminal instance into a container div.
 * Handles lifecycle (create → fit → dispose), ResizeObserver for auto-fit,
 * and wires onData/onResize callbacks for the parent to bridge to a PTY.
 *
 * Theme matches the neo-brutalist dark palette: #1A1A2E background, #FFFDF7 text,
 * JetBrains Mono font, cursor blinking.
 */
export const XTerminal = forwardRef<XTerminalHandle, XTerminalProps>(
  function XTerminal({ onData, onResize }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const fitPendingRef = useRef(false);

    /** Expose write/writeln to parent via ref. */
    useImperativeHandle(ref, () => ({
      write(data: string): void {
        terminalRef.current?.write(data);
      },
      writeln(line: string): void {
        terminalRef.current?.writeln(line);
      },
    }), []);

    /** Fit the terminal to its container. Skips when container has zero dimensions to prevent cursor corruption. */
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

    /** Debounced fit — coalesces multiple fit triggers within a single animation frame. */
    const scheduleFit = useCallback((): void => {
      if (fitPendingRef.current) return;
      fitPendingRef.current = true;
      requestAnimationFrame(() => {
        fit();
        fitPendingRef.current = false;
      });
    }, [fit]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const terminal = new Terminal({
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: "block",
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

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(container);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      /* Initial fit after DOM paint — uses guarded fit() to skip if container is hidden */
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

      /* Auto-fit on container resize */
      const resizeObserver = new ResizeObserver(() => {
        scheduleFit();
      });
      resizeObserver.observe(container);

      /* Re-fit when container transitions from hidden (display:none) to visible */
      const intersectionObserver = new IntersectionObserver(([entry]) => {
        if (entry && entry.intersectionRatio > 0) {
          scheduleFit();
        }
      });
      intersectionObserver.observe(container);

      /* Re-fit after minimize/restore or tab switch to fix corrupted cursor state */
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
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleWindowFocus);
        dataDisposable.dispose();
        resizeDisposable.dispose();
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
      };
    }, [onData, onResize, fit, scheduleFit]);

    return (
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ backgroundColor: "#1A1A2E" }}
        data-testid="xterminal-container"
      />
    );
  },
);
