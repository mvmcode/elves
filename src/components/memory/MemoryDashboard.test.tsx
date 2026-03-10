/* Tests for MemoryDashboard — verifies stat computation, category distribution, insight generation, and rendering. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  MemoryDashboard,
  computeStats,
  computeCategoryDistribution,
  generateInsights,
} from "./MemoryDashboard";
import type { MemoryEntry } from "@/types/memory";
import type { DashboardStats } from "./MemoryDashboard";

/** Factory for a test memory entry. */
function createTestMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 1,
    projectId: "project-1",
    category: "context",
    content: "Test memory content.",
    source: null,
    tags: "",
    createdAt: Date.now(),
    accessedAt: Date.now(),
    relevanceScore: 0.8,
    ...overrides,
  };
}

describe("computeStats", () => {
  it("returns zero stats for empty array", () => {
    const stats = computeStats([]);
    expect(stats).toEqual({ total: 0, pinned: 0, fading: 0, healthScore: 0 });
  });

  it("counts total memories", () => {
    const memories = [createTestMemory({ id: 1 }), createTestMemory({ id: 2 })];
    expect(computeStats(memories).total).toBe(2);
  });

  it("counts pinned memories by source field", () => {
    const memories = [
      createTestMemory({ id: 1, source: "pinned" }),
      createTestMemory({ id: 2, source: null }),
      createTestMemory({ id: 3, source: "pinned" }),
    ];
    expect(computeStats(memories).pinned).toBe(2);
  });

  it("counts fading memories below 0.3 threshold", () => {
    const memories = [
      createTestMemory({ id: 1, relevanceScore: 0.1 }),
      createTestMemory({ id: 2, relevanceScore: 0.5 }),
      createTestMemory({ id: 3, relevanceScore: 0.2 }),
    ];
    expect(computeStats(memories).fading).toBe(2);
  });

  it("computes health score as average relevance percentage", () => {
    const memories = [
      createTestMemory({ id: 1, relevanceScore: 0.6 }),
      createTestMemory({ id: 2, relevanceScore: 0.8 }),
    ];
    /* Average = 0.7, so healthScore = 70 */
    expect(computeStats(memories).healthScore).toBe(70);
  });
});

describe("computeCategoryDistribution", () => {
  it("returns all five categories", () => {
    const dist = computeCategoryDistribution([]);
    expect(dist).toHaveLength(5);
    expect(dist.map((d) => d.category)).toEqual([
      "context",
      "decision",
      "learning",
      "preference",
      "fact",
    ]);
  });

  it("counts memories per category", () => {
    const memories = [
      createTestMemory({ id: 1, category: "context" }),
      createTestMemory({ id: 2, category: "context" }),
      createTestMemory({ id: 3, category: "decision" }),
    ];
    const dist = computeCategoryDistribution(memories);
    expect(dist.find((d) => d.category === "context")?.count).toBe(2);
    expect(dist.find((d) => d.category === "decision")?.count).toBe(1);
    expect(dist.find((d) => d.category === "learning")?.count).toBe(0);
  });
});

describe("generateInsights", () => {
  it("shows empty-state insight when no memories exist", () => {
    const stats: DashboardStats = { total: 0, pinned: 0, fading: 0, healthScore: 0 };
    const insights = generateInsights([], stats);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.id).toBe("empty");
    expect(insights[0]!.message).toContain("Start a task");
  });

  it("shows fading insight when memories are below threshold", () => {
    const memories = [
      createTestMemory({ id: 1, relevanceScore: 0.1, category: "context" }),
    ];
    const stats: DashboardStats = { total: 1, pinned: 0, fading: 1, healthScore: 10 };
    const insights = generateInsights(memories, stats);
    const fading = insights.find((i) => i.id === "fading");
    expect(fading).toBeDefined();
    expect(fading!.message).toContain("1 memory fading");
  });

  it("shows missing category insights", () => {
    const memories = [createTestMemory({ id: 1, category: "context" })];
    const stats: DashboardStats = { total: 1, pinned: 0, fading: 0, healthScore: 80 };
    const insights = generateInsights(memories, stats);
    expect(insights.find((i) => i.id === "no-decisions")).toBeDefined();
    expect(insights.find((i) => i.id === "no-preferences")).toBeDefined();
    expect(insights.find((i) => i.id === "no-learnings")).toBeDefined();
  });

  it("shows pinned insight when pinned memories exist", () => {
    const memories = [
      createTestMemory({ id: 1, source: "pinned", category: "context" }),
    ];
    const stats: DashboardStats = { total: 1, pinned: 1, fading: 0, healthScore: 80 };
    const insights = generateInsights(memories, stats);
    const pinned = insights.find((i) => i.id === "pinned-strong");
    expect(pinned).toBeDefined();
    expect(pinned!.message).toContain("1 pinned memory");
  });

  it("shows all-healthy insight when all categories present and health > 70", () => {
    const memories = [
      createTestMemory({ id: 1, category: "context", relevanceScore: 0.9 }),
      createTestMemory({ id: 2, category: "decision", relevanceScore: 0.9 }),
      createTestMemory({ id: 3, category: "learning", relevanceScore: 0.9 }),
      createTestMemory({ id: 4, category: "preference", relevanceScore: 0.9 }),
      createTestMemory({ id: 5, category: "fact", relevanceScore: 0.9 }),
    ];
    const stats: DashboardStats = { total: 5, pinned: 0, fading: 0, healthScore: 90 };
    const insights = generateInsights(memories, stats);
    expect(insights.find((i) => i.id === "all-healthy")).toBeDefined();
  });
});

describe("MemoryDashboard", () => {
  it("renders the dashboard container", () => {
    render(<MemoryDashboard memories={[]} />);
    expect(screen.getByTestId("memory-dashboard")).toBeInTheDocument();
  });

  it("renders stat cards with correct values", () => {
    const memories = [
      createTestMemory({ id: 1, relevanceScore: 0.8, source: "pinned" }),
      createTestMemory({ id: 2, relevanceScore: 0.2 }),
    ];
    render(<MemoryDashboard memories={memories} />);

    expect(screen.getByTestId("stat-total-value")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-pinned-value")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-fading-value")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-health-value")).toHaveTextContent("50%");
  });

  it("renders zero stats for empty memories", () => {
    render(<MemoryDashboard memories={[]} />);

    expect(screen.getByTestId("stat-total-value")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-pinned-value")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-fading-value")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-health-value")).toHaveTextContent("0%");
  });

  it("renders category distribution bar when memories exist", () => {
    const memories = [
      createTestMemory({ id: 1, category: "context" }),
      createTestMemory({ id: 2, category: "decision" }),
    ];
    render(<MemoryDashboard memories={memories} />);

    expect(screen.getByTestId("category-distribution")).toBeInTheDocument();
    expect(screen.getByTestId("dist-context")).toBeInTheDocument();
    expect(screen.getByTestId("dist-decision")).toBeInTheDocument();
  });

  it("does not render distribution bar when no memories", () => {
    render(<MemoryDashboard memories={[]} />);
    expect(screen.queryByTestId("category-distribution")).not.toBeInTheDocument();
  });

  it("renders insights panel", () => {
    render(<MemoryDashboard memories={[]} />);
    expect(screen.getByTestId("dashboard-insights")).toBeInTheDocument();
    expect(screen.getByTestId("insight-empty")).toBeInTheDocument();
  });

  it("renders action buttons on insights with actions", () => {
    const onAdd = vi.fn();
    const memories = [createTestMemory({ id: 1, category: "context" })];
    render(<MemoryDashboard memories={memories} onAddWithCategory={onAdd} />);

    const addDecisionBtn = screen.getByTestId("insight-action-no-decisions");
    expect(addDecisionBtn).toHaveTextContent("Add Decision");

    fireEvent.click(addDecisionBtn);
    expect(onAdd).toHaveBeenCalledWith("decision");
  });

  it("renders fading insight for low-relevance memories", () => {
    const memories = [
      createTestMemory({ id: 1, relevanceScore: 0.1 }),
      createTestMemory({ id: 2, relevanceScore: 0.2 }),
    ];
    render(<MemoryDashboard memories={memories} />);

    expect(screen.getByTestId("insight-fading")).toBeInTheDocument();
  });
});
