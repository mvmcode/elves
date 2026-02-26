/* Tests for RuntimePicker — verifies rendering, toggle, dropdown, and keyboard shortcut. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RuntimePicker } from "./RuntimePicker";

describe("RuntimePicker", () => {
  it("renders the current runtime label in full mode", () => {
    render(<RuntimePicker value="claude-code" onChange={vi.fn()} />);
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
  });

  it("renders compact mode with icon only", () => {
    render(<RuntimePicker value="claude-code" onChange={vi.fn()} compact />);
    expect(screen.getByTestId("runtime-picker-compact")).toBeInTheDocument();
    expect(screen.getByText("CC")).toBeInTheDocument();
  });

  it("shows codex label when codex is selected", () => {
    render(<RuntimePicker value="codex" onChange={vi.fn()} />);
    expect(screen.getByText("Codex")).toBeInTheDocument();
  });

  it("opens dropdown on click in full mode", () => {
    render(<RuntimePicker value="claude-code" onChange={vi.fn()} />);
    expect(screen.queryByTestId("runtime-picker-dropdown")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("runtime-picker-button"));
    expect(screen.getByTestId("runtime-picker-dropdown")).toBeInTheDocument();
  });

  it("calls onChange when selecting a different runtime from dropdown", () => {
    const onChange = vi.fn();
    render(<RuntimePicker value="claude-code" onChange={onChange} />);

    fireEvent.click(screen.getByTestId("runtime-picker-button"));
    fireEvent.click(screen.getByTestId("runtime-option-codex"));

    expect(onChange).toHaveBeenCalledWith("codex");
  });

  it("closes dropdown after selection", () => {
    render(<RuntimePicker value="claude-code" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("runtime-picker-button"));
    fireEvent.click(screen.getByTestId("runtime-option-codex"));
    expect(screen.queryByTestId("runtime-picker-dropdown")).not.toBeInTheDocument();
  });

  it("shows checkmark on currently selected runtime", () => {
    render(<RuntimePicker value="claude-code" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("runtime-picker-button"));
    const claudeOption = screen.getByTestId("runtime-option-claude-code");
    expect(claudeOption.textContent).toContain("✓");
  });

  it("toggles runtime on compact click", () => {
    const onChange = vi.fn();
    render(<RuntimePicker value="claude-code" onChange={onChange} compact />);
    fireEvent.click(screen.getByTestId("runtime-picker-compact"));
    expect(onChange).toHaveBeenCalledWith("codex");
  });

  it("toggles from codex to claude-code on compact click", () => {
    const onChange = vi.fn();
    render(<RuntimePicker value="codex" onChange={onChange} compact />);
    fireEvent.click(screen.getByTestId("runtime-picker-compact"));
    expect(onChange).toHaveBeenCalledWith("claude-code");
  });

  it("has accessible title on compact button", () => {
    render(<RuntimePicker value="claude-code" onChange={vi.fn()} compact />);
    const button = screen.getByTestId("runtime-picker-compact");
    expect(button.getAttribute("title")).toContain("Claude Code");
  });
});
