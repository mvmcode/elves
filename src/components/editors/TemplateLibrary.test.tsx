/* Tests for TemplateLibrary — verifies card rendering, empty state, and actions. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TemplateLibrary } from "./TemplateLibrary";
import { useTemplateStore } from "@/stores/templates";
import type { Template } from "@/types/template";

/* Mock the template actions hook to prevent IPC calls and auto-loading */
vi.mock("@/hooks/useTemplateActions", () => ({
  useTemplateActions: () => ({
    loadTemplates: vi.fn(),
    handleSaveTemplate: vi.fn(),
    handleDeleteTemplate: vi.fn(),
    handleLoadTemplate: vi.fn().mockResolvedValue(null),
  }),
}));

function createTestTemplate(overrides?: Partial<Template>): Template {
  return {
    id: "tmpl-1",
    name: "Frontend Setup",
    description: "Sets up a React frontend project",
    plan: {
      complexity: "team",
      agentCount: 3,
      roles: [
        { name: "Lead", focus: "Coordination", runtime: "claude-code" },
        { name: "UI", focus: "Components", runtime: "claude-code" },
        { name: "Tests", focus: "Testing", runtime: "codex" },
      ],
      taskGraph: [],
      runtimeRecommendation: "claude-code",
      estimatedDuration: "10 min",
    },
    builtIn: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("TemplateLibrary", () => {
  beforeEach(() => {
    useTemplateStore.setState({ templates: [], isLoading: false });
  });

  it("shows empty state when no templates exist", () => {
    render(<TemplateLibrary />);
    expect(screen.getByTestId("template-library-empty")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    useTemplateStore.setState({ isLoading: true });
    render(<TemplateLibrary />);
    expect(screen.getByText("Loading templates...")).toBeInTheDocument();
  });

  it("renders template cards", () => {
    useTemplateStore.setState({
      templates: [createTestTemplate(), createTestTemplate({ id: "tmpl-2", name: "Backend API" })],
    });
    render(<TemplateLibrary />);
    const cards = screen.getAllByTestId("template-card");
    expect(cards).toHaveLength(2);
  });

  it("shows template name and description", () => {
    useTemplateStore.setState({ templates: [createTestTemplate()] });
    render(<TemplateLibrary />);
    expect(screen.getByText("Frontend Setup")).toBeInTheDocument();
    expect(screen.getByText("Sets up a React frontend project")).toBeInTheDocument();
  });

  it("shows elf count and role count", () => {
    useTemplateStore.setState({ templates: [createTestTemplate()] });
    render(<TemplateLibrary />);
    expect(screen.getByText("3 elves")).toBeInTheDocument();
    expect(screen.getByText("3 roles")).toBeInTheDocument();
  });

  it("shows role pills", () => {
    useTemplateStore.setState({ templates: [createTestTemplate()] });
    render(<TemplateLibrary />);
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("UI")).toBeInTheDocument();
    expect(screen.getByText("Tests")).toBeInTheDocument();
  });

  it("shows Built-in badge for built-in templates", () => {
    useTemplateStore.setState({
      templates: [createTestTemplate({ builtIn: true })],
    });
    render(<TemplateLibrary />);
    expect(screen.getByText("Built-in")).toBeInTheDocument();
  });

  it("shows Delete button only for custom templates", () => {
    useTemplateStore.setState({
      templates: [
        createTestTemplate({ id: "custom", builtIn: false }),
        createTestTemplate({ id: "builtin", name: "Default", builtIn: true }),
      ],
    });
    render(<TemplateLibrary />);
    const deleteButtons = screen.getAllByText("Delete");
    expect(deleteButtons).toHaveLength(1);
  });

  it("shows Use Template button on every card", () => {
    useTemplateStore.setState({
      templates: [createTestTemplate(), createTestTemplate({ id: "tmpl-2", name: "Other" })],
    });
    render(<TemplateLibrary />);
    const useButtons = screen.getAllByText("Use Template");
    expect(useButtons).toHaveLength(2);
  });

  it("shows singular 'elf' for single agent", () => {
    const singlePlan = {
      ...createTestTemplate().plan,
      agentCount: 1,
      roles: [{ name: "Solo", focus: "All", runtime: "claude-code" as const }],
    };
    useTemplateStore.setState({
      templates: [createTestTemplate({ plan: singlePlan })],
    });
    render(<TemplateLibrary />);
    expect(screen.getByText("1 elf")).toBeInTheDocument();
    expect(screen.getByText("1 role")).toBeInTheDocument();
  });
});
