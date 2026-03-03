/* ThemePicker — visual theme switcher with preview cards for each available theme. */

import { useCallback } from "react";
import { useSettingsStore, type ThemeName } from "@/stores/settings";

interface ThemeOption {
  readonly id: ThemeName;
  readonly name: string;
  readonly description: string;
}

const THEMES: readonly ThemeOption[] = [
  {
    id: "neo-brutalist",
    name: "Neo-Brutalist",
    description: "Bold borders, hard shadows, sharp corners. The original elf aesthetic.",
  },
  {
    id: "neo-brutalist-dark",
    name: "Neo-Brutalist Dark",
    description: "Navy canvas, gold borders, hard shadows. Brutalism after sundown.",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean lines, subtle shadows, rounded corners. Notion/Linear inspired.",
  },
  {
    id: "modern-dark",
    name: "Modern Dark",
    description: "Zinc-900 surface, indigo accent, soft glow. Dark mode done right.",
  },
] as const;

/**
 * Mini-mockup that visually represents the neo-brutalist theme.
 * Uses inline styles to guarantee correct appearance regardless of active theme.
 */
function NeoBrutalistPreview(): React.JSX.Element {
  return (
    <div
      className="flex flex-col gap-2 p-3"
      style={{ background: "#FFFDF7" }}
    >
      {/* Mini header bar */}
      <div
        className="flex items-center gap-2"
        style={{
          background: "#FFD93D",
          border: "3px solid #000",
          boxShadow: "3px 3px 0px 0px #000",
          padding: "6px 10px",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            background: "#000",
            borderRadius: 0,
          }}
        />
        <div
          style={{
            height: 6,
            flex: 1,
            background: "#000",
            opacity: 0.7,
          }}
        />
      </div>

      {/* Mini content card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "3px solid #000",
          boxShadow: "4px 4px 0px 0px #000",
          padding: "8px",
        }}
      >
        <div
          style={{
            height: 5,
            width: "60%",
            background: "#000",
            marginBottom: 6,
          }}
        />
        <div
          style={{
            height: 4,
            width: "80%",
            background: "#000",
            opacity: 0.3,
            marginBottom: 4,
          }}
        />
        <div
          style={{
            height: 4,
            width: "50%",
            background: "#000",
            opacity: 0.3,
          }}
        />
      </div>

      {/* Mini button row */}
      <div className="flex gap-2">
        <div
          style={{
            background: "#FFD93D",
            border: "2px solid #000",
            boxShadow: "2px 2px 0px 0px #000",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 700,
            color: "#000",
            letterSpacing: "0.05em",
          }}
        >
          DEPLOY
        </div>
        <div
          style={{
            background: "#FFFFFF",
            border: "2px solid #000",
            boxShadow: "2px 2px 0px 0px #000",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 700,
            color: "#000",
          }}
        >
          CANCEL
        </div>
      </div>
    </div>
  );
}

/**
 * Mini-mockup that visually represents the modern theme.
 * Uses inline styles to guarantee correct appearance regardless of active theme.
 */
function ModernPreview(): React.JSX.Element {
  return (
    <div
      className="flex flex-col gap-2 p-3"
      style={{ background: "#FFFFFF" }}
    >
      {/* Mini header bar */}
      <div
        className="flex items-center gap-2"
        style={{
          background: "#5B5BD6",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          padding: "6px 10px",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            background: "#FFFFFF",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            height: 6,
            flex: 1,
            background: "#FFFFFF",
            opacity: 0.7,
            borderRadius: 3,
          }}
        />
      </div>

      {/* Mini content card */}
      <div
        style={{
          background: "#FAFAFA",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
          padding: "8px",
        }}
      >
        <div
          style={{
            height: 5,
            width: "60%",
            background: "#1A1A1A",
            borderRadius: 2,
            marginBottom: 6,
          }}
        />
        <div
          style={{
            height: 4,
            width: "80%",
            background: "#1A1A1A",
            opacity: 0.2,
            borderRadius: 2,
            marginBottom: 4,
          }}
        />
        <div
          style={{
            height: 4,
            width: "50%",
            background: "#1A1A1A",
            opacity: 0.2,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Mini button row */}
      <div className="flex gap-2">
        <div
          style={{
            background: "#5B5BD6",
            border: "1px solid #4747A1",
            borderRadius: 6,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 500,
            color: "#FFFFFF",
          }}
        >
          Deploy
        </div>
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 6,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 500,
            color: "#1A1A1A",
          }}
        >
          Cancel
        </div>
      </div>
    </div>
  );
}

/**
 * Mini-mockup that visually represents the neo-brutalist-dark theme.
 * Navy background, gold borders, hard shadows — brutalism after sundown.
 */
function NeoBrutalistDarkPreview(): React.JSX.Element {
  return (
    <div
      className="flex flex-col gap-2 p-3"
      style={{ background: "#1A1A2E" }}
    >
      {/* Mini header bar */}
      <div
        className="flex items-center gap-2"
        style={{
          background: "#FFD93D",
          border: "2px solid #FFD93D",
          boxShadow: "3px 3px 0px 0px rgba(255,217,61,0.3)",
          padding: "6px 10px",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            background: "#000",
            borderRadius: 0,
          }}
        />
        <div
          style={{
            height: 6,
            flex: 1,
            background: "#000",
            opacity: 0.7,
          }}
        />
      </div>

      {/* Mini content card */}
      <div
        style={{
          background: "#16213E",
          border: "2px solid #FFD93D",
          boxShadow: "4px 4px 0px 0px rgba(255,217,61,0.3)",
          padding: "8px",
        }}
      >
        <div
          style={{
            height: 5,
            width: "60%",
            background: "#FFFDF7",
            marginBottom: 6,
          }}
        />
        <div
          style={{
            height: 4,
            width: "80%",
            background: "#FFFDF7",
            opacity: 0.3,
            marginBottom: 4,
          }}
        />
        <div
          style={{
            height: 4,
            width: "50%",
            background: "#FFFDF7",
            opacity: 0.3,
          }}
        />
      </div>

      {/* Mini button row */}
      <div className="flex gap-2">
        <div
          style={{
            background: "#FFD93D",
            border: "2px solid #FFD93D",
            boxShadow: "2px 2px 0px 0px rgba(255,217,61,0.3)",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 700,
            color: "#000",
            letterSpacing: "0.05em",
          }}
        >
          DEPLOY
        </div>
        <div
          style={{
            background: "#16213E",
            border: "2px solid #FFD93D",
            boxShadow: "2px 2px 0px 0px rgba(255,217,61,0.3)",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 700,
            color: "#FFFDF7",
          }}
        >
          CANCEL
        </div>
      </div>
    </div>
  );
}

/**
 * Mini-mockup that visually represents the modern-dark theme.
 * Zinc-900 surface, indigo accent, soft shadows, rounded corners.
 */
function ModernDarkPreview(): React.JSX.Element {
  return (
    <div
      className="flex flex-col gap-2 p-3"
      style={{ background: "#18181B" }}
    >
      {/* Mini header bar */}
      <div
        className="flex items-center gap-2"
        style={{
          background: "#818CF8",
          border: "1px solid #6366F1",
          borderRadius: 8,
          boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          padding: "6px 10px",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            background: "#FFFFFF",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            height: 6,
            flex: 1,
            background: "#FFFFFF",
            opacity: 0.7,
            borderRadius: 3,
          }}
        />
      </div>

      {/* Mini content card */}
      <div
        style={{
          background: "#27272A",
          border: "1px solid #3F3F46",
          borderRadius: 8,
          boxShadow: "0 4px 6px rgba(0,0,0,0.5)",
          padding: "8px",
        }}
      >
        <div
          style={{
            height: 5,
            width: "60%",
            background: "#FAFAFA",
            borderRadius: 2,
            marginBottom: 6,
          }}
        />
        <div
          style={{
            height: 4,
            width: "80%",
            background: "#FAFAFA",
            opacity: 0.25,
            borderRadius: 2,
            marginBottom: 4,
          }}
        />
        <div
          style={{
            height: 4,
            width: "50%",
            background: "#FAFAFA",
            opacity: 0.25,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Mini button row */}
      <div className="flex gap-2">
        <div
          style={{
            background: "#818CF8",
            border: "1px solid #6366F1",
            borderRadius: 6,
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 500,
            color: "#FFFFFF",
          }}
        >
          Deploy
        </div>
        <div
          style={{
            background: "#27272A",
            border: "1px solid #3F3F46",
            borderRadius: 6,
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            padding: "3px 10px",
            fontSize: 8,
            fontWeight: 500,
            color: "#FAFAFA",
          }}
        >
          Cancel
        </div>
      </div>
    </div>
  );
}

/**
 * Theme picker for the settings view. Shows visual preview cards for each
 * available theme. Clicking a card instantly applies the theme.
 */
export default function ThemePicker(): React.JSX.Element {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  const handleSelect = useCallback(
    (id: ThemeName): void => {
      setTheme(id);
    },
    [setTheme],
  );

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="theme-picker">
      {/* Header */}
      <div>
        <h2 className="font-display text-3xl text-heading">
          Theme
        </h2>
        <p className="mt-1 font-body text-sm text-text-muted">
          Choose how ELVES looks. Changes apply instantly.
        </p>
      </div>

      {/* Theme cards */}
      <div className="flex flex-wrap gap-6">
        {THEMES.map((option) => {
          const isActive = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className={[
                "group w-[240px] cursor-pointer border-token-normal border-border bg-surface-elevated text-left shadow-md transition-all duration-100",
                "rounded-md",
                "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-sm",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                isActive
                  ? "ring-3 ring-accent ring-offset-2 ring-offset-surface"
                  : "",
              ].join(" ")}
              aria-pressed={isActive}
              data-testid={`theme-card-${option.id}`}
            >
              {/* Preview mockup */}
              <div className="overflow-hidden rounded-t-md border-b-token-normal border-border">
                {option.id === "neo-brutalist" ? (
                  <NeoBrutalistPreview />
                ) : option.id === "neo-brutalist-dark" ? (
                  <NeoBrutalistDarkPreview />
                ) : option.id === "modern-dark" ? (
                  <ModernDarkPreview />
                ) : (
                  <ModernPreview />
                )}
              </div>

              {/* Label area */}
              <div className="flex items-start gap-3 p-4">
                {/* Selection indicator */}
                <div
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-token-normal border-border rounded-sm",
                    isActive ? "bg-accent" : "bg-surface-elevated",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isActive && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 6L5 9L10 3"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                    </svg>
                  )}
                </div>

                <div className="min-w-0">
                  <span className="font-display text-sm text-label">
                    {option.name}
                  </span>
                  <p className="mt-0.5 font-body text-xs text-text-muted">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
