/* Tests for MemoryCard — verifies rendering, pin toggle, delete confirmation, edit callback, truncation, tags, and fading warning. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryCard } from "./MemoryCard";
import type { MemoryEntry } from "@/types/memory";

/** Factory for a test memory entry */
function createTestMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 1,
    projectId: "project-1",
    category: "context",
    content: "The project uses Tauri v2 with React frontend.",
    source: null,
    tags: "",
    createdAt: Date.now(),
    accessedAt: Date.now(),
    relevanceScore: 0.75,
    ...overrides,
  };
}

describe("MemoryCard", () => {
  it("renders the memory card container", () => {
    render(
      <MemoryCard
        memory={createTestMemory()}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("memory-card")).toBeInTheDocument();
  });

  it("displays the category badge", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ category: "decision" })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("memory-category")).toHaveTextContent("Decision");
  });

  it("displays the memory content", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ content: "Use SQLite for persistence" })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("memory-content")).toHaveTextContent("Use SQLite for persistence");
  });

  it("displays the source label", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ source: "manual" })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("memory-source")).toHaveTextContent("manual");
  });

  it("displays auto source when source is null", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ source: null })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("memory-source")).toHaveTextContent("auto");
  });

  it("displays relevance score segments", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ relevanceScore: 0.8 })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const segments = screen.getAllByTestId("relevance-segment");
    expect(segments).toHaveLength(10);
  });

  it("displays the timestamp", () => {
    render(
      <MemoryCard
        memory={createTestMemory()}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("memory-timestamp")).toBeInTheDocument();
  });

  it("shows filled star when pinned", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ source: "pinned" })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const pinButton = screen.getByTestId("memory-pin");
    expect(pinButton).toHaveTextContent("\u2605 Pinned");
  });

  it("shows empty star when not pinned", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ source: null })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const pinButton = screen.getByTestId("memory-pin");
    expect(pinButton).toHaveTextContent("\u2606 Pin");
  });

  it("fires onPin callback when pin button is clicked", () => {
    const onPin = vi.fn();
    const memory = createTestMemory();
    render(
      <MemoryCard memory={memory} onEdit={vi.fn()} onPin={onPin} onDelete={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId("memory-pin"));
    expect(onPin).toHaveBeenCalledOnce();
    expect(onPin).toHaveBeenCalledWith(memory);
  });

  it("fires onEdit callback when edit button is clicked", () => {
    const onEdit = vi.fn();
    const memory = createTestMemory();
    render(
      <MemoryCard memory={memory} onEdit={onEdit} onPin={vi.fn()} onDelete={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId("memory-edit"));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(memory);
  });

  it("shows delete confirmation when delete is clicked", () => {
    render(
      <MemoryCard
        memory={createTestMemory()}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("memory-delete"));
    expect(screen.getByTestId("delete-confirm")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("fires onDelete when confirmation Yes is clicked", () => {
    const onDelete = vi.fn();
    const memory = createTestMemory();
    render(
      <MemoryCard memory={memory} onEdit={vi.fn()} onPin={vi.fn()} onDelete={onDelete} />,
    );

    fireEvent.click(screen.getByTestId("memory-delete"));
    fireEvent.click(screen.getByTestId("delete-confirm-yes"));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(memory);
  });

  it("cancels delete when confirmation No is clicked", () => {
    const onDelete = vi.fn();
    render(
      <MemoryCard
        memory={createTestMemory()}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByTestId("memory-delete"));
    fireEvent.click(screen.getByTestId("delete-confirm-no"));
    expect(onDelete).not.toHaveBeenCalled();
    /* Should restore the action buttons */
    expect(screen.queryByTestId("delete-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId("memory-delete")).toBeInTheDocument();
  });

  it("renders all category styles correctly", () => {
    const categories = ["context", "decision", "learning", "preference", "fact"] as const;
    const labels = ["Context", "Decision", "Learning", "Preference", "Fact"];

    categories.forEach((category, index) => {
      const { unmount } = render(
        <MemoryCard
          memory={createTestMemory({ category })}
          onEdit={vi.fn()}
          onPin={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByTestId("memory-category")).toHaveTextContent(labels[index]!);
      unmount();
    });
  });

  /* --- Content truncation tests --- */

  it("truncates long content and shows 'Show more' toggle", () => {
    const longContent = "A".repeat(200);
    render(
      <MemoryCard
        memory={createTestMemory({ content: longContent })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const contentEl = screen.getByTestId("memory-content");
    expect(contentEl.textContent).toHaveLength(153); /* 150 chars + "..." */
    expect(screen.getByTestId("content-toggle")).toHaveTextContent("Show more");
  });

  it("expands content when 'Show more' is clicked", () => {
    const longContent = "B".repeat(200);
    render(
      <MemoryCard
        memory={createTestMemory({ content: longContent })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("content-toggle"));
    const contentEl = screen.getByTestId("memory-content");
    expect(contentEl.textContent).toHaveLength(200);
    expect(screen.getByTestId("content-toggle")).toHaveTextContent("Show less");
  });

  it("collapses content when 'Show less' is clicked", () => {
    const longContent = "C".repeat(200);
    render(
      <MemoryCard
        memory={createTestMemory({ content: longContent })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("content-toggle"));
    fireEvent.click(screen.getByTestId("content-toggle"));
    const contentEl = screen.getByTestId("memory-content");
    expect(contentEl.textContent).toHaveLength(153);
  });

  it("does not show toggle for short content", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ content: "Short content" })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("content-toggle")).not.toBeInTheDocument();
  });

  /* --- Tag badge tests --- */

  it("renders tag badges from JSON tags string", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ tags: '["tauri","react","typescript"]' })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByTestId("memory-tags")).toBeInTheDocument();
    const tags = screen.getAllByTestId("memory-tag");
    expect(tags).toHaveLength(3);
    expect(tags[0]).toHaveTextContent("tauri");
    expect(tags[1]).toHaveTextContent("react");
    expect(tags[2]).toHaveTextContent("typescript");
  });

  it("does not render tags section for empty tags string", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ tags: "" })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("memory-tags")).not.toBeInTheDocument();
  });

  it("handles invalid JSON tags gracefully", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ tags: "not-json" })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("memory-tags")).not.toBeInTheDocument();
  });

  /* --- Fading warning tests --- */

  it("shows fading warning badge when relevance < 0.3", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ relevanceScore: 0.2 })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fading-warning")).toBeInTheDocument();
    expect(screen.getByTestId("fading-warning")).toHaveTextContent("Fading");
  });

  it("does not show fading warning when relevance >= 0.3", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ relevanceScore: 0.5 })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("fading-warning")).not.toBeInTheDocument();
  });

  it("applies warning border accent on fading cards", () => {
    render(
      <MemoryCard
        memory={createTestMemory({ relevanceScore: 0.1 })}
        onEdit={vi.fn()}
        onPin={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const card = screen.getByTestId("memory-card");
    expect(card.className).toContain("border-l-warning");
  });
});
