/* ShortcutOverlay — neo-brutalist modal showing all keyboard shortcuts. */

import { SHORTCUT_DEFINITIONS } from "@/hooks/useKeyboardShortcuts";

interface ShortcutOverlayProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Modal overlay showing all available keyboard shortcuts in a neo-brutalist card.
 * Rendered as a fixed overlay on top of the app.
 */
export function ShortcutOverlay({
  isOpen,
  onClose,
}: ShortcutOverlayProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      data-testid="shortcut-overlay"
    >
      <div
        className="w-full max-w-md border-[3px] border-border bg-white p-6 shadow-brutal-xl"
        onClick={(event) => event.stopPropagation()}
        data-testid="shortcut-card"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center border-[2px] border-border bg-error font-display text-sm font-black text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            data-testid="close-overlay"
          >
            ×
          </button>
        </div>

        {/* Shortcut list */}
        <div className="space-y-2">
          {SHORTCUT_DEFINITIONS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between border-b-[2px] border-border/20 py-2 last:border-b-0"
            >
              <span className="font-body text-sm">{shortcut.description}</span>
              <kbd className="border-[2px] border-border bg-elf-gold-light px-2 py-1 font-mono text-xs font-bold">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-4 font-body text-xs text-text-light/40">
          Press ⌘/ to toggle this overlay
        </p>
      </div>
    </div>
  );
}
