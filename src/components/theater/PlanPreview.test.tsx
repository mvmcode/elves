/* Tests for PlanPreview — verifies plan card rendering, edit controls, and deploy callback. */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlanPreview } from "./PlanPreview";
import type { TaskPlan } from "@/types/session";

/** Factory for a test task plan with sensible defaults. */
function createTestPlan(overrides?: Partial<TaskPlan>): TaskPlan {
  return {
    complexity: "team",
    agentCount: 3,
    roles: [
      { name: "Lead", focus: "Coordinate the implementation", runtime: "claude-code" },
      { name: "Frontend", focus: "Build the UI components", runtime: "claude-code" },
      { name: "Backend", focus: "Implement API endpoints", runtime: "codex" },
    ],
    taskGraph: [
      { id: "t1", label: "Setup", assignee: "Lead", dependsOn: [], status: "pending" },
      { id: "t2", label: "Build UI", assignee: "Frontend", dependsOn: ["t1"], status: "pending" },
      { id: "t3", label: "Build API", assignee: "Backend", dependsOn: ["t1"], status: "pending" },
    ],
    runtimeRecommendation: "claude-code",
    estimatedDuration: "~5 minutes",
    ...overrides,
  };
}

describe("PlanPreview", () => {
  it("renders the plan preview container", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByTestId("plan-preview")).toBeInTheDocument();
  });

  it("displays the deployment plan heading", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByText("Deployment Plan")).toBeInTheDocument();
  });

  it("shows agent count badge", () => {
    const plan = createTestPlan({ agentCount: 3 });
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByText("3 Agents")).toBeInTheDocument();
  });

  it("shows estimated duration badge", () => {
    const plan = createTestPlan({ estimatedDuration: "~5 minutes" });
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByText("~5 minutes")).toBeInTheDocument();
  });

  it("renders correct number of role cards", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    const cards = screen.getAllByTestId("role-card");
    expect(cards).toHaveLength(3);
  });

  it("shows role names on cards", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("shows role focus text", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByText("Coordinate the implementation")).toBeInTheDocument();
    expect(screen.getByText("Build the UI components")).toBeInTheDocument();
    expect(screen.getByText("Implement API endpoints")).toBeInTheDocument();
  });

  it("renders runtime selects with correct initial values", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    const selects = screen.getAllByTestId("runtime-select");
    expect(selects).toHaveLength(3);
    /* First two roles are claude-code, third is codex */
    expect((selects[0] as HTMLSelectElement).value).toBe("claude-code");
    expect((selects[2] as HTMLSelectElement).value).toBe("codex");
  });

  it("allows changing runtime via dropdown", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    const selects = screen.getAllByTestId("runtime-select");
    fireEvent.change(selects[0]!, { target: { value: "codex" } });
    expect((selects[0] as HTMLSelectElement).value).toBe("codex");
  });

  it("enters inline edit mode when focus text is clicked", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    const focusTexts = screen.getAllByTestId("role-focus-text");
    fireEvent.click(focusTexts[0]!);
    expect(screen.getByTestId("role-focus-input")).toBeInTheDocument();
  });

  it("commits inline edit on Enter key", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);

    /* Click to start editing first role focus */
    const focusTexts = screen.getAllByTestId("role-focus-text");
    fireEvent.click(focusTexts[0]!);

    const input = screen.getByTestId("role-focus-input");
    fireEvent.change(input, { target: { value: "Updated focus text" } });
    fireEvent.keyDown(input, { key: "Enter" });

    /* Should show the updated text and exit edit mode */
    expect(screen.getByText("Updated focus text")).toBeInTheDocument();
    expect(screen.queryByTestId("role-focus-input")).not.toBeInTheDocument();
  });

  it("removes a role card when X is clicked", async () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);

    const removeButtons = screen.getAllByTestId("remove-role");
    expect(removeButtons).toHaveLength(3);

    fireEvent.click(removeButtons[0]!);

    /* AnimatePresence exit animation may keep the element briefly — wait for removal */
    await waitFor(() => {
      const cards = screen.getAllByTestId("role-card");
      expect(cards).toHaveLength(2);
    });
  });

  it("adds a new role card when + Add Agent is clicked", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);

    fireEvent.click(screen.getByTestId("add-role"));

    /* Should now have 4 cards */
    const cards = screen.getAllByTestId("role-card");
    expect(cards).toHaveLength(4);
  });

  it("fires onDeploy callback with plan when deploy button is clicked", () => {
    const plan = createTestPlan();
    const onDeploy = vi.fn();
    render(<PlanPreview plan={plan} onDeploy={onDeploy} />);

    fireEvent.click(screen.getByTestId("deploy-button"));
    expect(onDeploy).toHaveBeenCalledOnce();
    expect(onDeploy).toHaveBeenCalledWith(expect.objectContaining({ complexity: "team" }));
  });

  it("shows edit plan button when onEdit is provided", () => {
    const plan = createTestPlan();
    const onEdit = vi.fn();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} onEdit={onEdit} />);

    const editButton = screen.getByTestId("edit-plan-button");
    expect(editButton).toBeInTheDocument();
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("does not show edit button when onEdit is not provided", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.queryByTestId("edit-plan-button")).not.toBeInTheDocument();
  });

  it("renders task flow dots for each graph node", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    const dots = screen.getAllByTestId("task-flow-dot");
    expect(dots).toHaveLength(3);
  });

  it("renders arrows between task flow nodes", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    const arrows = screen.getAllByTestId("task-flow-arrow");
    /* 3 nodes = 2 arrows between them */
    expect(arrows).toHaveLength(2);
  });

  it("shows runtime recommendation", () => {
    const plan = createTestPlan({ runtimeRecommendation: "claude-code" });
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByTestId("runtime-recommendation").textContent).toContain("claude-code");
  });

  it("renders add-role button", () => {
    const plan = createTestPlan();
    render(<PlanPreview plan={plan} onDeploy={vi.fn()} />);
    expect(screen.getByTestId("add-role")).toBeInTheDocument();
    expect(screen.getByText("+ Add Agent")).toBeInTheDocument();
  });
});
