/* TerminalToolbar — compact toolbar above the terminal with session status,
 * duration timer, search, font controls, copy, clear, and kill actions. */

import { useCallback, useEffect, useRef, useState } from "react";

/** Session status for display in the toolbar. */
type TerminalStatus = "live" | "idle" | "exited";

export interface TerminalToolbarProps {
  readonly status: TerminalStatus;
  readonly startTime: number | null;
  readonly onClear: () => void;
  readonly onKill: () => void;
  readonly onSearch: (query: string) => void;
  readonly onClearSearch: () => void;
  readonly onFontSizeChange: (delta: number) => void;
  readonly onCopy: () => void;
  readonly isSearchOpen: boolean;
  readonly onToggleSearch: () => void;
  readonly searchMatchCount?: number;
  readonly currentMatch?: number;
  readonly onSearchNext?: () => void;
  readonly onSearchPrev?: () => void;
}

/** Status badge color mapping. */
const STATUS_COLORS: Record<TerminalStatus, { dot: string; bg: string; text: string }> = {
  live: { dot: "#6BCB77", bg: "rgba(107, 203, 119, 0.15)", text: "#6BCB77" },
  idle: { dot: "#FFD93D", bg: "rgba(255, 217, 61, 0.15)", text: "#FFD93D" },
  exited: { dot: "#FF6B6B", bg: "rgba(255, 107, 107, 0.15)", text: "#FF6B6B" },
};

/** Format elapsed seconds into "Xm Ys" or "Xh Ym" display. */
function formatDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  if (totalSeconds < 0) return "0s";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/* ── Inline SVG Icons ─────────────────────────────────────────────────── */

function SearchIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <circle cx="10" cy="10" r="7" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

function ClearIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M3 6h18M8 6V4h8v2M5 6v14h14V6" />
    </svg>
  );
}

function CopyIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <rect x="9" y="9" width="13" height="13" />
      <path d="M5 15H3V3h12v2" />
    </svg>
  );
}

function StopIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <rect x="4" y="4" width="16" height="16" fill="currentColor" />
    </svg>
  );
}

function ChevronUpIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
      <line x1="4" y1="4" x2="20" y2="20" />
      <line x1="20" y1="4" x2="4" y2="20" />
    </svg>
  );
}

/* ── Toolbar Button ───────────────────────────────────────────────────── */

interface ToolbarButtonProps {
  readonly onClick: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly variant?: "default" | "danger";
  readonly "data-testid"?: string;
}

function ToolbarButton({ onClick, title, children, variant = "default", "data-testid": testId }: ToolbarButtonProps): React.JSX.Element {
  const isDanger = variant === "danger";
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={[
        "flex h-6 w-6 cursor-pointer items-center justify-center border-[2px] transition-all duration-100",
        isDanger
          ? "border-[#FF6B6B]/60 bg-[#FF6B6B]/10 text-[#FF6B6B] hover:bg-[#FF6B6B] hover:text-black"
          : "border-[#FFFDF7]/15 bg-transparent text-[#FFFDF7]/60 hover:border-[#FFD93D]/50 hover:bg-[#FFD93D]/10 hover:text-[#FFD93D]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ── Duration Timer ───────────────────────────────────────────────────── */

function DurationTimer({ startTime }: { readonly startTime: number | null }): React.JSX.Element {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startTime === null) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startTime);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (startTime === null) return <span data-testid="duration-timer" />;

  return (
    <span
      className="font-mono text-[11px] text-[#FFFDF7]/40"
      data-testid="duration-timer"
    >
      {formatDuration(elapsed)}
    </span>
  );
}

/* ── Main Toolbar ─────────────────────────────────────────────────────── */

export function TerminalToolbar({
  status,
  startTime,
  onClear,
  onKill,
  onSearch,
  onClearSearch,
  onFontSizeChange,
  onCopy,
  isSearchOpen,
  onToggleSearch,
  searchMatchCount = 0,
  currentMatch = 0,
  onSearchNext,
  onSearchPrev,
}: TerminalToolbarProps): React.JSX.Element {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const statusStyle = STATUS_COLORS[status];

  /* Focus search input when opened */
  useEffect(() => {
    if (isSearchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    } else {
      setSearchQuery("");
    }
  }, [isSearchOpen]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const query = event.target.value;
      setSearchQuery(query);
      if (query.length > 0) {
        onSearch(query);
      } else {
        onClearSearch();
      }
    },
    [onSearch, onClearSearch],
  );

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Escape") {
        onToggleSearch();
      } else if (event.key === "Enter") {
        if (event.shiftKey) {
          onSearchPrev?.();
        } else {
          onSearchNext?.();
        }
      }
    },
    [onToggleSearch, onSearchNext, onSearchPrev],
  );

  const handleCloseSearch = useCallback((): void => {
    onClearSearch();
    onToggleSearch();
  }, [onClearSearch, onToggleSearch]);

  return (
    <div
      className="flex flex-col border-b-[2px] border-[#FFFDF7]/10 bg-[#12122A]"
      data-testid="terminal-toolbar"
    >
      {/* Main toolbar row */}
      <div className="flex h-8 items-center justify-between px-2">
        {/* Left section: status badge + duration */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 border-[2px] px-2 py-0.5"
            style={{
              borderColor: statusStyle.text,
              backgroundColor: statusStyle.bg,
            }}
            data-testid="status-badge"
          >
            <span
              className="inline-block h-2 w-2"
              style={{
                backgroundColor: statusStyle.dot,
                boxShadow: status === "live" ? `0 0 4px ${statusStyle.dot}` : "none",
              }}
              data-testid="status-dot"
            />
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{ color: statusStyle.text }}
              data-testid="status-label"
            >
              {status}
            </span>
          </div>
          <DurationTimer startTime={startTime} />
        </div>

        {/* Right section: action buttons */}
        <div className="flex items-center gap-1">
          <ToolbarButton onClick={onToggleSearch} title="Search (Ctrl+F)" data-testid="search-toggle">
            <SearchIcon />
          </ToolbarButton>
          <ToolbarButton onClick={onClear} title="Clear scrollback" data-testid="clear-button">
            <ClearIcon />
          </ToolbarButton>
          <ToolbarButton onClick={() => onFontSizeChange(-1)} title="Decrease font size" data-testid="font-size-decrease">
            <span className="font-mono text-[10px] font-bold">A-</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => onFontSizeChange(1)} title="Increase font size" data-testid="font-size-increase">
            <span className="font-mono text-[10px] font-bold">A+</span>
          </ToolbarButton>
          <ToolbarButton onClick={onCopy} title="Copy selection" data-testid="copy-button">
            <CopyIcon />
          </ToolbarButton>
          {status !== "exited" && (
            <ToolbarButton onClick={onKill} title="Kill session" variant="danger" data-testid="kill-button">
              <StopIcon />
            </ToolbarButton>
          )}
        </div>
      </div>

      {/* Search bar row (conditionally rendered) */}
      {isSearchOpen && (
        <div
          className="flex h-8 items-center gap-2 border-t-[2px] border-[#FFFDF7]/10 px-2"
          data-testid="search-bar"
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            className="h-6 flex-1 border-[2px] border-[#FFFDF7]/20 bg-[#1A1A2E] px-2 font-mono text-[12px] text-[#FFFDF7] outline-none placeholder:text-[#FFFDF7]/30 focus:border-[#FFD93D] focus:shadow-[2px_2px_0px_0px_#FFD93D]"
            data-testid="search-input"
          />
          {searchQuery.length > 0 && (
            <span
              className="font-mono text-[10px] text-[#FFFDF7]/50"
              data-testid="search-match-count"
            >
              {searchMatchCount > 0 ? `${currentMatch} of ${searchMatchCount}` : "0 results"}
            </span>
          )}
          <ToolbarButton onClick={() => onSearchPrev?.()} title="Previous match (Shift+Enter)" data-testid="search-prev">
            <ChevronUpIcon />
          </ToolbarButton>
          <ToolbarButton onClick={() => onSearchNext?.()} title="Next match (Enter)" data-testid="search-next">
            <ChevronDownIcon />
          </ToolbarButton>
          <ToolbarButton onClick={handleCloseSearch} title="Close search (Esc)" data-testid="search-close">
            <CloseIcon />
          </ToolbarButton>
        </div>
      )}
    </div>
  );
}
