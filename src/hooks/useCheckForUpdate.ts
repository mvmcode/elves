// Non-blocking update check — runs once on mount, shows toast if newer version exists.
// Uses the Homebrew tap formula on macOS, GitHub releases on Windows/Linux.

import { useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { checkHomebrewUpdate } from "@/lib/tauri";
import { useToastStore } from "@/stores/toast";

/** Compare two semver strings (major.minor.patch). Returns true if remote > local. */
function isNewerVersion(local: string, remote: string): boolean {
  const parse = (v: string): number[] => v.split(".").map(Number);
  const [lMajor = 0, lMinor = 0, lPatch = 0] = parse(local);
  const [rMajor = 0, rMinor = 0, rPatch = 0] = parse(remote);

  if (rMajor !== lMajor) return rMajor > lMajor;
  if (rMinor !== lMinor) return rMinor > lMinor;
  return rPatch > lPatch;
}

/** Detect platform from navigator (best-effort). */
function isMacOS(): boolean {
  return typeof navigator !== "undefined" && navigator.platform?.startsWith("Mac");
}

/** Check for updates on mount. Shows a persistent toast if a newer version exists. */
export function useCheckForUpdate(): void {
  useEffect(() => {
    let cancelled = false;

    async function check(): Promise<void> {
      const [localVersion, remoteVersion] = await Promise.all([
        getVersion(),
        checkHomebrewUpdate(),
      ]);

      if (cancelled || !remoteVersion) return;
      if (!isNewerVersion(localVersion, remoteVersion)) return;

      const updateAction = isMacOS()
        ? {
            label: "COPY COMMAND",
            onClick: () => {
              void navigator.clipboard.writeText("brew upgrade --cask elves");
            },
          }
        : {
            label: "DOWNLOAD",
            onClick: () => {
              void window.open(
                "https://github.com/mvmcode/elves/releases/latest",
                "_blank",
              );
            },
          };

      useToastStore.getState().addToast({
        message: `ELVES ${remoteVersion} is available`,
        variant: "info",
        duration: 0,
        action: updateAction,
      });
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, []);
}
