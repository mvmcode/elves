/* Tests for MemoryExplorer — verifies list rendering, empty state, filters, search, and add form. */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryExplorer } from "./MemoryExplorer";
import { useMemoryStore } from "@/stores/memory";
import type { MemoryEntry } from "@/types/memory";

/** Reset memory store between tests */
function resetStore(): void {
  useMemoryStore.setState({
    memories: [],
    searchQuery: "",
    activeCategory: null,
    isLoading: false,
  });
}

/** Factory for a test memory entry */
function createTestMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 1,
    projectId: "project-1",
    category: "context",
    content: "The project uses Tauri v2.",
    source: null,
    tags: "",
    createdAt: Date.now(),
    accessedAt: Date.now(),
    relevanceScore: 0.8,
    ...overrides,
  };
}

describe("MemoryExplorer", () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the explorer container", () => {
    render(<MemoryExplorer />);
    expect(screen.getByTestId("memory-explorer")).toBeInTheDocument();
  });

  it("renders the Memory Explorer heading", () => {
    render(<MemoryExplorer />);
    expect(screen.getByText("Memory Explorer")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<MemoryExplorer />);
    expect(screen.getByTestId("memory-search")).toBeInTheDocument();
  });

  it("renders all category filter buttons", () => {
    render(<MemoryExplorer />);
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("filter-context")).toBeInTheDocument();
    expect(screen.getByTestId("filter-decisions")).toBeInTheDocument();
    expect(screen.getByTestId("filter-learnings")).toBeInTheDocument();
    expect(screen.getByTestId("filter-preferences")).toBeInTheDocument();
    expect(screen.getByTestId("filter-facts")).toBeInTheDocument();
  });

  it("shows empty state when no memories exist", () => {
    render(<MemoryExplorer />);
    expect(screen.getByTestId("memory-empty")).toBeInTheDocument();
    expect(screen.getByText("Your elves have amnesia.")).toBeInTheDocument();
  });

  it("renders memory cards when memories exist", () => {
    useMemoryStore.setState({
      memories: [
        createTestMemory({ id: 1, content: "Memory one" }),
        createTestMemory({ id: 2, content: "Memory two" }),
      ],
    });

    render(<MemoryExplorer />);
    expect(screen.getByTestId("memory-list")).toBeInTheDocument();
    const cards = screen.getAllByTestId("memory-card");
    expect(cards).toHaveLength(2);
  });

  it("filters memories when a category button is clicked", () => {
    useMemoryStore.setState({
      memories: [
        createTestMemory({ id: 1, category: "context" }),
        createTestMemory({ id: 2, category: "decision" }),
        createTestMemory({ id: 3, category: "context" }),
      ],
    });

    render(<MemoryExplorer />);

    /* Click "Context" filter */
    fireEvent.click(screen.getByTestId("filter-context"));

    const cards = screen.getAllByTestId("memory-card");
    expect(cards).toHaveLength(2);
  });

  it("shows all memories when All filter is clicked after filtering", () => {
    useMemoryStore.setState({
      memories: [
        createTestMemory({ id: 1, category: "context" }),
        createTestMemory({ id: 2, category: "decision" }),
      ],
    });

    render(<MemoryExplorer />);

    /* Filter to context only */
    fireEvent.click(screen.getByTestId("filter-context"));
    expect(screen.getAllByTestId("memory-card")).toHaveLength(1);

    /* Click All to reset */
    fireEvent.click(screen.getByTestId("filter-all"));
    expect(screen.getAllByTestId("memory-card")).toHaveLength(2);
  });

  it("updates search query on input change", () => {
    render(<MemoryExplorer />);

    const searchInput = screen.getByTestId("memory-search");
    fireEvent.change(searchInput, { target: { value: "tauri" } });

    expect(useMemoryStore.getState().searchQuery).toBe("tauri");
  });

  it("debounces onSearch callback", () => {
    const onSearch = vi.fn();
    render(<MemoryExplorer onSearch={onSearch} />);

    const searchInput = screen.getByTestId("memory-search");
    fireEvent.change(searchInput, { target: { value: "tau" } });
    fireEvent.change(searchInput, { target: { value: "tauri" } });

    /* Should not fire immediately */
    expect(onSearch).not.toHaveBeenCalled();

    /* Advance past debounce timer */
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith("tauri");
  });

  it("opens the add memory form when button is clicked", () => {
    render(<MemoryExplorer />);

    fireEvent.click(screen.getByTestId("add-memory-button"));
    expect(screen.getByTestId("add-memory-form")).toBeInTheDocument();
    expect(screen.getByTestId("add-memory-category")).toBeInTheDocument();
    expect(screen.getByTestId("add-memory-content")).toBeInTheDocument();
  });

  it("closes the add form on cancel", () => {
    render(<MemoryExplorer />);

    fireEvent.click(screen.getByTestId("add-memory-button"));
    expect(screen.getByTestId("add-memory-form")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("add-memory-cancel"));
    expect(screen.queryByTestId("add-memory-form")).not.toBeInTheDocument();
  });

  it("fires onCreateMemory when save is clicked with content", () => {
    const onCreateMemory = vi.fn();
    render(<MemoryExplorer onCreateMemory={onCreateMemory} />);

    fireEvent.click(screen.getByTestId("add-memory-button"));
    fireEvent.change(screen.getByTestId("add-memory-content"), {
      target: { value: "New memory content" },
    });
    fireEvent.click(screen.getByTestId("add-memory-save"));

    expect(onCreateMemory).toHaveBeenCalledOnce();
    expect(onCreateMemory).toHaveBeenCalledWith("context", "New memory content");
  });

  it("does not fire onCreateMemory when content is empty", () => {
    const onCreateMemory = vi.fn();
    render(<MemoryExplorer onCreateMemory={onCreateMemory} />);

    fireEvent.click(screen.getByTestId("add-memory-button"));
    fireEvent.click(screen.getByTestId("add-memory-save"));

    expect(onCreateMemory).not.toHaveBeenCalled();
  });

  it("shows loading skeleton when isLoading is true", () => {
    useMemoryStore.setState({ isLoading: true });
    render(<MemoryExplorer />);
    expect(screen.getByTestId("memory-loading")).toBeInTheDocument();
  });

  it("shows the add memory button", () => {
    render(<MemoryExplorer />);
    expect(screen.getByTestId("add-memory-button")).toBeInTheDocument();
  });
});
