/* Tests for TaskGraph — verifies rendering for linear, fan-out, and fan-in dependency structures. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskGraph } from "./TaskGraph";
import type { TaskNode } from "@/types/session";

/** Factory for a test task node. */
function createNode(overrides?: Partial<TaskNode>): TaskNode {
  return {
    id: "t1",
    label: "Setup",
    assignee: "Lead",
    dependsOn: [],
    status: "pending",
    ...overrides,
  };
}

describe("TaskGraph", () => {
  it("renders the graph container", () => {
    const nodes = [createNode()];
    render(<TaskGraph nodes={nodes} />);
    expect(screen.getByTestId("task-graph")).toBeInTheDocument();
  });

  it("renders the SVG element", () => {
    const nodes = [createNode()];
    render(<TaskGraph nodes={nodes} />);
    expect(screen.getByTestId("task-graph-svg")).toBeInTheDocument();
  });

  it("shows empty state when no nodes", () => {
    render(<TaskGraph nodes={[]} />);
    expect(screen.getByTestId("task-graph-empty")).toBeInTheDocument();
    expect(screen.getByText("No tasks in graph")).toBeInTheDocument();
  });

  it("renders correct number of nodes for a linear graph (A→B→C)", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Setup", dependsOn: [] }),
      createNode({ id: "b", label: "Build", dependsOn: ["a"] }),
      createNode({ id: "c", label: "Deploy", dependsOn: ["b"] }),
    ];
    render(<TaskGraph nodes={nodes} />);
    const graphNodes = screen.getAllByTestId("task-graph-node");
    expect(graphNodes).toHaveLength(3);
  });

  it("renders correct number of edges for linear graph (A→B→C)", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Setup", dependsOn: [] }),
      createNode({ id: "b", label: "Build", dependsOn: ["a"] }),
      createNode({ id: "c", label: "Deploy", dependsOn: ["b"] }),
    ];
    render(<TaskGraph nodes={nodes} />);
    const edges = screen.getAllByTestId("task-graph-edge");
    /* A→B and B→C = 2 edges */
    expect(edges).toHaveLength(2);
  });

  it("renders fan-out graph (A→B, A→C)", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Setup", dependsOn: [] }),
      createNode({ id: "b", label: "Frontend", dependsOn: ["a"] }),
      createNode({ id: "c", label: "Backend", dependsOn: ["a"] }),
    ];
    render(<TaskGraph nodes={nodes} />);
    const graphNodes = screen.getAllByTestId("task-graph-node");
    expect(graphNodes).toHaveLength(3);
    const edges = screen.getAllByTestId("task-graph-edge");
    /* A→B and A→C = 2 edges */
    expect(edges).toHaveLength(2);
  });

  it("renders fan-in graph (A→C, B→C)", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Research", dependsOn: [] }),
      createNode({ id: "b", label: "Design", dependsOn: [] }),
      createNode({ id: "c", label: "Implement", dependsOn: ["a", "b"] }),
    ];
    render(<TaskGraph nodes={nodes} />);
    const graphNodes = screen.getAllByTestId("task-graph-node");
    expect(graphNodes).toHaveLength(3);
    const edges = screen.getAllByTestId("task-graph-edge");
    /* A→C and B→C = 2 edges */
    expect(edges).toHaveLength(2);
  });

  it("renders node labels", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Setup" }),
      createNode({ id: "b", label: "Build", dependsOn: ["a"] }),
    ];
    render(<TaskGraph nodes={nodes} />);
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Build")).toBeInTheDocument();
  });

  it("truncates long node labels", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "This is a very long task name that should be truncated" }),
    ];
    render(<TaskGraph nodes={nodes} />);
    expect(screen.getByText("This is a very...")).toBeInTheDocument();
  });

  it("fires onNodeClick when a node is clicked", () => {
    const onNodeClick = vi.fn();
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Setup" }),
    ];
    render(<TaskGraph nodes={nodes} onNodeClick={onNodeClick} />);

    const graphNodes = screen.getAllByTestId("task-graph-node");
    fireEvent.click(graphNodes[0]!);
    expect(onNodeClick).toHaveBeenCalledOnce();
    expect(onNodeClick).toHaveBeenCalledWith("a");
  });

  it("renders single node with no edges", () => {
    const nodes: TaskNode[] = [createNode({ id: "a", label: "Solo Task" })];
    render(<TaskGraph nodes={nodes} />);
    const graphNodes = screen.getAllByTestId("task-graph-node");
    expect(graphNodes).toHaveLength(1);
    expect(screen.queryByTestId("task-graph-edge")).not.toBeInTheDocument();
  });

  it("handles complex diamond graph (A→B, A→C, B→D, C→D)", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Start", dependsOn: [] }),
      createNode({ id: "b", label: "Path 1", dependsOn: ["a"] }),
      createNode({ id: "c", label: "Path 2", dependsOn: ["a"] }),
      createNode({ id: "d", label: "Merge", dependsOn: ["b", "c"] }),
    ];
    render(<TaskGraph nodes={nodes} />);
    const graphNodes = screen.getAllByTestId("task-graph-node");
    expect(graphNodes).toHaveLength(4);
    const edges = screen.getAllByTestId("task-graph-edge");
    /* A→B, A→C, B→D, C→D = 4 edges */
    expect(edges).toHaveLength(4);
  });

  it("renders nodes with different statuses", () => {
    const nodes: TaskNode[] = [
      createNode({ id: "a", label: "Done Task", status: "done" }),
      createNode({ id: "b", label: "Active Task", status: "active", dependsOn: ["a"] }),
      createNode({ id: "c", label: "Pending Task", status: "pending", dependsOn: ["b"] }),
      createNode({ id: "d", label: "Error Task", status: "error", dependsOn: ["b"] }),
    ];
    render(<TaskGraph nodes={nodes} />);
    const graphNodes = screen.getAllByTestId("task-graph-node");
    expect(graphNodes).toHaveLength(4);
  });
});
