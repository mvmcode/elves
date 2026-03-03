/* FileSearch — debounced text input for filtering the file tree by name. */

import { useState, useEffect, useRef } from "react";
import { useFileExplorerStore } from "@/stores/fileExplorer";

/** Debounced search input that filters file tree nodes by name (case-insensitive). */
export function FileSearch(): React.JSX.Element {
  const setSearchQuery = useFileExplorerStore((s) => s.setSearchQuery);
  const [localQuery, setLocalQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 300);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [localQuery, setSearchQuery]);

  return (
    <div className="px-2 py-1.5">
      <input
        type="text"
        value={localQuery}
        onChange={(event) => setLocalQuery(event.target.value)}
        placeholder="Search files..."
        className="w-full border-[2px] border-[#333] bg-[#12121f] px-2 py-1 font-mono text-xs text-[#c8c5bd] outline-none placeholder:text-[#555] focus:border-[#FFD93D]"
        data-testid="file-search-input"
      />
    </div>
  );
}
