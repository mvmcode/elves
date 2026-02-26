/* Tests for SkillEditor — verifies split panel, skill list, editor, and actions. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillEditor } from "./SkillEditor";
import { useSkillStore } from "@/stores/skills";
import type { Skill } from "@/types/skill";

/* Mock skill actions to prevent IPC calls */
vi.mock("@/hooks/useSkillActions", () => ({
  useSkillActions: () => ({
    loadSkills: vi.fn(),
    handleCreateSkill: vi.fn(),
    handleUpdateSkill: vi.fn(),
    handleDeleteSkill: vi.fn(),
  }),
}));

function createTestSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: "skill-1",
    projectId: null,
    name: "Code Review",
    description: "Review code for quality",
    content: "## Instructions\nReview carefully.",
    triggerPattern: "/review",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("SkillEditor", () => {
  beforeEach(() => {
    useSkillStore.setState({ skills: [], activeSkillId: null, isLoading: false });
  });

  it("renders the skill editor container", () => {
    render(<SkillEditor />);
    expect(screen.getByTestId("skill-editor")).toBeInTheDocument();
  });

  it("shows empty state when no skills exist", () => {
    render(<SkillEditor />);
    expect(screen.getByTestId("skill-editor-empty")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    useSkillStore.setState({ isLoading: true });
    render(<SkillEditor />);
    expect(screen.getByText("Loading skills...")).toBeInTheDocument();
  });

  it("renders skill list items", () => {
    useSkillStore.setState({
      skills: [createTestSkill(), createTestSkill({ id: "skill-2", name: "Deploy" })],
    });
    render(<SkillEditor />);
    const items = screen.getAllByTestId("skill-list-item");
    expect(items).toHaveLength(2);
  });

  it("shows skill name in list", () => {
    useSkillStore.setState({ skills: [createTestSkill()] });
    render(<SkillEditor />);
    expect(screen.getByText("Code Review")).toBeInTheDocument();
  });

  it("shows skill description in list", () => {
    useSkillStore.setState({ skills: [createTestSkill()] });
    render(<SkillEditor />);
    expect(screen.getByText("Review code for quality")).toBeInTheDocument();
  });

  it("loads skill into editor when selected", () => {
    useSkillStore.setState({
      skills: [createTestSkill()],
      activeSkillId: "skill-1",
    });
    render(<SkillEditor />);
    const nameInput = screen.getByTestId("skill-name-input") as HTMLInputElement;
    expect(nameInput.value).toBe("Code Review");
    const contentEditor = screen.getByTestId("skill-content-editor") as HTMLTextAreaElement;
    expect(contentEditor.value).toBe("## Instructions\nReview carefully.");
  });

  it("shows trigger pattern in editor", () => {
    useSkillStore.setState({
      skills: [createTestSkill()],
      activeSkillId: "skill-1",
    });
    render(<SkillEditor />);
    const triggerInput = screen.getByTestId("skill-trigger-input") as HTMLInputElement;
    expect(triggerInput.value).toBe("/review");
  });

  it("shows Unsaved badge when content is edited", () => {
    useSkillStore.setState({
      skills: [createTestSkill()],
      activeSkillId: "skill-1",
    });
    render(<SkillEditor />);
    expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();

    const contentEditor = screen.getByTestId("skill-content-editor");
    fireEvent.change(contentEditor, { target: { value: "changed" } });
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });

  it("shows select prompt when skills exist but none selected", () => {
    useSkillStore.setState({ skills: [createTestSkill()], activeSkillId: null });
    render(<SkillEditor />);
    expect(screen.getByText("Select a skill to edit")).toBeInTheDocument();
  });

  it("renders New button", () => {
    render(<SkillEditor />);
    expect(screen.getByText("+ New")).toBeInTheDocument();
  });

  it("shows Save and Delete buttons when a skill is active", () => {
    useSkillStore.setState({
      skills: [createTestSkill()],
      activeSkillId: "skill-1",
    });
    render(<SkillEditor />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("groups skills into Global and Project sections", () => {
    useSkillStore.setState({
      skills: [
        createTestSkill({ id: "global-1", projectId: null, name: "Global Skill" }),
        createTestSkill({ id: "proj-1", projectId: "proj-123", name: "Project Skill" }),
      ],
    });
    render(<SkillEditor />);
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
  });
});
