// Non-blocking Homebrew update check — runs once on mount, shows toast if newer version exists.

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

/** Check Homebrew tap for updates on mount. Shows a persistent toast if a newer version exists. */
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

      useToastStore.getState().addToast({
        message: `ELVES ${remoteVersion} is available`,
        variant: "info",
        duration: 0,
        action: {
          label: "COPY COMMAND",
          onClick: () => {
            void navigator.clipboard.writeText("brew upgrade --cask elves");
          },
        },
      });
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, []);
}
