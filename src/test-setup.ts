/* Test environment setup — extends vitest matchers with jest-dom assertions. */
import "@testing-library/jest-dom/vitest";

/* Mock window.matchMedia for jsdom — required by xterm.js CoreBrowserService. */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

/* Mock ResizeObserver for jsdom — required by XTerminal auto-fit. */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof globalThis.ResizeObserver;
}
