/* MemoryExplorer — full-page memory browser with search, category filters, and inline add form. */

import { useState, useCallback, useEffect, useRef } from "react";
import { MemoryCard } from "./MemoryCard";
import { Button } from "@/components/shared/Button";
import { useMemoryStore } from "@/stores/memory";
import type { MemoryEntry, MemoryCategory } from "@/types/memory";

interface MemoryExplorerProps {
  /** Called when a memory should be created via IPC */
  readonly onCreateMemory?: (category: MemoryCategory, content: string) => void;
  /** Called when a memory should be edited via IPC */
  readonly onEditMemory?: (memory: MemoryEntry) => void;
  /** Called when a memory should be pinned/unpinned via IPC */
  readonly onPinMemory?: (memory: MemoryEntry) => void;
  /** Called when a memory should be deleted via IPC */
  readonly onDeleteMemory?: (memory: MemoryEntry) => void;
  /** Called when search query changes (debounced) */
  readonly onSearch?: (query: string) => void;
}

/** Category filter button definitions. */
const CATEGORY_FILTERS: readonly { value: MemoryCategory | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "context", label: "Context" },
  { value: "decision", label: "Decisions" },
  { value: "learning", label: "Learnings" },
  { value: "preference", label: "Preferences" },
  { value: "fact", label: "Facts" },
];

/** Available categories for the add-memory form. */
const ADD_CATEGORIES: readonly { value: MemoryCategory; label: string }[] = [
  { value: "context", label: "Context" },
  { value: "decision", label: "Decision" },
  { value: "learning", label: "Learning" },
  { value: "preference", label: "Preference" },
  { value: "fact", label: "Fact" },
];

/**
 * Full-page memory explorer with search, category filters, memory card list,
 * empty state, and inline add-memory form. Reads from and writes to the memory store.
 */
export function MemoryExplorer({
  onCreateMemory,
  onEditMemory,
  onPinMemory,
  onDeleteMemory,
  onSearch,
}: MemoryExplorerProps): React.JSX.Element {
  const {
    memories,
    searchQuery,
    activeCategory,
    isLoading,
    setSearchQuery,
    setActiveCategory,
  } = useMemoryStore();

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<MemoryCategory>("context");
  const [addContent, setAddContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Debounced search handler — fires onSearch after 300ms pause. */
  const handleSearchChange = useCallback(
    (value: string): void => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch?.(value);
      }, 300);
    },
    [setSearchQuery, onSearch],
  );

  /** Cleanup debounce timer on unmount */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** Filter memories by active category (search filtering is done by the backend). */
  const filteredMemories = activeCategory
    ? memories.filter((m) => m.category === activeCategory)
    : memories;

  const handleSaveMemory = useCallback((): void => {
    if (!addContent.trim()) return;
    onCreateMemory?.(addCategory, addContent.trim());
    setAddContent("");
    setAddCategory("context");
    setIsAddFormOpen(false);
  }, [addCategory, addContent, onCreateMemory]);

  const handleCancelAdd = useCallback((): void => {
    setAddContent("");
    setAddCategory("context");
    setIsAddFormOpen(false);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="memory-explorer">
      {/* Header */}
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide">
        Memory Explorer
      </h1>

      {/* Search bar */}
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => handleSearchChange(event.target.value)}
        placeholder="Search memories..."
        className="w-full border-[3px] border-border bg-white px-4 py-3 font-body text-base text-text-light outline-none placeholder:text-text-light/40 focus:shadow-[4px_4px_0px_0px_#FFD93D]"
        data-testid="memory-search"
      />

      {/* Category filter row */}
      <div className="flex flex-wrap gap-2" data-testid="memory-filters">
        {CATEGORY_FILTERS.map((filter) => {
          const isActive = activeCategory === filter.value;
          return (
            <button
              key={filter.label}
              onClick={() => setActiveCategory(filter.value)}
              className={[
                "cursor-pointer border-[3px] border-border px-4 py-2 font-body text-sm font-bold uppercase tracking-wider transition-all duration-100",
                isActive
                  ? "bg-elf-gold text-text-light shadow-brutal-sm"
                  : "bg-white text-text-light hover:bg-elf-gold-light",
              ].join(" ")}
              data-testid={`filter-${filter.label.toLowerCase()}`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Memory list */}
      {isLoading ? (
        <div className="flex flex-col gap-4" data-testid="memory-loading">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse border-[3px] border-border bg-gray-100"
            />
          ))}
        </div>
      ) : filteredMemories.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 py-16"
          data-testid="memory-empty"
        >
          <span className="text-6xl">🧠</span>
          <p className="font-display text-xl font-bold uppercase tracking-wide text-gray-400">
            Your elves have amnesia.
          </p>
          <p className="font-body text-sm text-gray-400">
            Start a task to build memories.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="memory-list">
          {filteredMemories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={(m) => onEditMemory?.(m)}
              onPin={(m) => onPinMemory?.(m)}
              onDelete={(m) => onDeleteMemory?.(m)}
            />
          ))}
        </div>
      )}

      {/* Add memory section */}
      {isAddFormOpen ? (
        <div
          className="border-[3px] border-border bg-surface-light p-5 shadow-brutal"
          data-testid="add-memory-form"
        >
          <h3 className="mb-3 font-display text-lg font-bold uppercase tracking-wide">
            Add Memory
          </h3>
          <div className="flex flex-col gap-3">
            <select
              value={addCategory}
              onChange={(event) => setAddCategory(event.target.value as MemoryCategory)}
              className="border-[3px] border-border bg-white px-4 py-2 font-body text-sm font-bold uppercase tracking-wider outline-none"
              data-testid="add-memory-category"
            >
              {ADD_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <textarea
              value={addContent}
              onChange={(event) => setAddContent(event.target.value)}
              placeholder="Enter memory content..."
              rows={3}
              className="border-[3px] border-border bg-white px-4 py-3 font-body text-sm text-text-light outline-none placeholder:text-text-light/40 focus:shadow-[4px_4px_0px_0px_#FFD93D]"
              data-testid="add-memory-content"
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSaveMemory} data-testid="add-memory-save">
                Save
              </Button>
              <Button variant="secondary" onClick={handleCancelAdd} data-testid="add-memory-cancel">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="primary"
          onClick={() => setIsAddFormOpen(true)}
          className="self-start"
          data-testid="add-memory-button"
        >
          + Add Memory
        </Button>
      )}
    </div>
  );
}
