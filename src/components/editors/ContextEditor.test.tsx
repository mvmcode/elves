/* Tests for ContextEditor — verifies sections, toggles, preview, and auto-context. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextEditor } from "./ContextEditor";
import { useProjectStore } from "@/stores/project";

/* Mock Tauri IPC */
vi.mock("@/lib/tauri", () => ({
  buildProjectContext: vi.fn().mockResolvedValue("Auto-generated context from memory."),
}));

describe("ContextEditor", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], activeProjectId: "proj-1" });
  });

  it("renders the context editor container", () => {
    render(<ContextEditor />);
    expect(screen.getByTestId("context-editor")).toBeInTheDocument();
  });

  it("shows no-project message when no project selected", () => {
    useProjectStore.setState({ activeProjectId: null });
    render(<ContextEditor />);
    expect(screen.getByTestId("context-editor-no-project")).toBeInTheDocument();
  });

  it("renders all four default sections", () => {
    render(<ContextEditor />);
    const sections = screen.getAllByTestId("context-section");
    expect(sections).toHaveLength(4);
  });

  it("shows section titles", () => {
    render(<ContextEditor />);
    expect(screen.getByText("Project Overview")).toBeInTheDocument();
    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByText("Coding Standards")).toBeInTheDocument();
    expect(screen.getByText("Custom Instructions")).toBeInTheDocument();
  });

  it("renders toggle switches for each section", () => {
    render(<ContextEditor />);
    const toggles = screen.getAllByTestId("context-section-toggle");
    expect(toggles).toHaveLength(4);
  });

  it("all sections start enabled", () => {
    render(<ContextEditor />);
    const toggles = screen.getAllByTestId("context-section-toggle");
    for (const toggle of toggles) {
      expect(toggle.getAttribute("aria-checked")).toBe("true");
    }
  });

  it("toggles a section off and hides editor", () => {
    render(<ContextEditor />);
    const editors = screen.getAllByTestId("context-section-editor");
    expect(editors).toHaveLength(4);

    const toggles = screen.getAllByTestId("context-section-toggle");
    fireEvent.click(toggles[0]!);

    const editorsAfter = screen.getAllByTestId("context-section-editor");
    expect(editorsAfter).toHaveLength(3);
  });

  it("shows textarea editors for enabled sections", () => {
    render(<ContextEditor />);
    const editors = screen.getAllByTestId("context-section-editor");
    expect(editors.length).toBeGreaterThan(0);
  });

  it("renders auto-context section", () => {
    render(<ContextEditor />);
    expect(screen.getByTestId("auto-context-section")).toBeInTheDocument();
  });

  it("shows Refresh button for auto-context", () => {
    render(<ContextEditor />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("shows 'Preview Full Context' button", () => {
    render(<ContextEditor />);
    expect(screen.getByText("Preview Full Context")).toBeInTheDocument();
  });

  it("toggles preview panel on click", () => {
    render(<ContextEditor />);
    expect(screen.queryByTestId("context-preview")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Preview Full Context"));
    expect(screen.getByTestId("context-preview")).toBeInTheDocument();
  });

  it("hides preview panel on second click", () => {
    render(<ContextEditor />);
    fireEvent.click(screen.getByText("Preview Full Context"));
    expect(screen.getByTestId("context-preview")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide Preview"));
    expect(screen.queryByTestId("context-preview")).not.toBeInTheDocument();
  });

  it("shows placeholder text in editors", () => {
    render(<ContextEditor />);
    const editors = screen.getAllByTestId("context-section-editor");
    const firstEditor = editors[0] as HTMLTextAreaElement;
    expect(firstEditor.placeholder).toContain("Describe what this project does");
  });

  it("updates content when typing in section editor", () => {
    render(<ContextEditor />);
    const editors = screen.getAllByTestId("context-section-editor");
    const firstEditor = editors[0] as HTMLTextAreaElement;
    fireEvent.change(firstEditor, { target: { value: "My project overview" } });
    expect(firstEditor.value).toBe("My project overview");
  });
});
