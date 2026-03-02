/* Tests for AgentPromptPopup — verifies yes/no and text input modes, elf header, and actions. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentPromptPopup } from "./AgentPromptPopup";
import type { Elf } from "@/types/elf";

/* Mock sounds to avoid AudioContext in test environment */
vi.mock("@/lib/sounds", () => ({
  playSound: vi.fn(),
}));

const MOCK_ELF: Elf = {
  id: "elf-1",
  sessionId: "s1",
  name: "Tinker",
  role: "lead",
  avatar: "tinker",
  color: "#4D96FF",
  quirk: "always hums",
  runtime: "claude-code",
  status: "chatting",
  spawnedAt: Date.now(),
  finishedAt: null,
  parentElfId: null,
  toolsUsed: [],
};

const defaultProps = {
  questionText: "Should I proceed with the refactor?",
  promptType: "yes_no" as const,
  leadElf: MOCK_ELF,
  onSubmit: vi.fn(),
  onDismiss: vi.fn(),
  onOpenTerminal: vi.fn(),
  isSubmitting: false,
};

describe("AgentPromptPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the popup container", () => {
    render(<AgentPromptPopup {...defaultProps} />);
    expect(screen.getByTestId("agent-prompt-popup")).toBeInTheDocument();
  });

  it("shows elf name in the header", () => {
    render(<AgentPromptPopup {...defaultProps} />);
    expect(screen.getByTestId("prompt-elf-name")).toHaveTextContent("Tinker is asking...");
  });

  it("defaults to Spark when leadElf is null", () => {
    render(<AgentPromptPopup {...defaultProps} leadElf={null} />);
    expect(screen.getByTestId("prompt-elf-name")).toHaveTextContent("Spark is asking...");
  });

  it("renders elf avatar in header", () => {
    render(<AgentPromptPopup {...defaultProps} />);
    expect(screen.getByTestId("elf-avatar")).toBeInTheDocument();
  });

  it("renders yes/no buttons for yes_no promptType", () => {
    render(<AgentPromptPopup {...defaultProps} promptType="yes_no" />);
    expect(screen.getByTestId("yes-no-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-yes-btn")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-no-btn")).toBeInTheDocument();
  });

  it("does not render text input for yes_no promptType", () => {
    render(<AgentPromptPopup {...defaultProps} promptType="yes_no" />);
    expect(screen.queryByTestId("text-input-area")).not.toBeInTheDocument();
  });

  it("renders text input for text_input promptType", () => {
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" />);
    expect(screen.getByTestId("text-input-area")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-text-input")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-send-btn")).toBeInTheDocument();
  });

  it("does not render yes/no buttons for text_input promptType", () => {
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" />);
    expect(screen.queryByTestId("yes-no-buttons")).not.toBeInTheDocument();
  });

  it("calls onSubmit with affirmative message when yes button is clicked", () => {
    const onSubmit = vi.fn();
    render(<AgentPromptPopup {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("prompt-yes-btn"));
    expect(onSubmit).toHaveBeenCalledWith("Yes, please proceed.");
  });

  it("calls onSubmit with negative message when no button is clicked", () => {
    const onSubmit = vi.fn();
    render(<AgentPromptPopup {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("prompt-no-btn"));
    expect(onSubmit).toHaveBeenCalledWith("No, do not do that.");
  });

  it("calls onSubmit with typed message when SEND is clicked", () => {
    const onSubmit = vi.fn();
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId("prompt-text-input"), { target: { value: "Fix both files" } });
    fireEvent.click(screen.getByTestId("prompt-send-btn"));
    expect(onSubmit).toHaveBeenCalledWith("Fix both files");
  });

  it("submits text on Enter key", () => {
    const onSubmit = vi.fn();
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" onSubmit={onSubmit} />);
    const input = screen.getByTestId("prompt-text-input");
    fireEvent.change(input, { target: { value: "Use option A" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("Use option A");
  });

  it("calls onDismiss on Escape key in text input", () => {
    const onDismiss = vi.fn();
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" onDismiss={onDismiss} />);
    fireEvent.keyDown(screen.getByTestId("prompt-text-input"), { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when Dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<AgentPromptPopup {...defaultProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId("prompt-dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onOpenTerminal when Go Super Mode is clicked", () => {
    const onOpenTerminal = vi.fn();
    render(<AgentPromptPopup {...defaultProps} onOpenTerminal={onOpenTerminal} />);
    fireEvent.click(screen.getByTestId("prompt-super-mode"));
    expect(onOpenTerminal).toHaveBeenCalledOnce();
  });

  it("disables yes/no buttons when isSubmitting is true", () => {
    render(<AgentPromptPopup {...defaultProps} isSubmitting={true} />);
    expect(screen.getByTestId("prompt-yes-btn")).toBeDisabled();
    expect(screen.getByTestId("prompt-no-btn")).toBeDisabled();
  });

  it("disables text input and send button when isSubmitting is true", () => {
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" isSubmitting={true} />);
    expect(screen.getByTestId("prompt-text-input")).toBeDisabled();
    expect(screen.getByTestId("prompt-send-btn")).toBeDisabled();
  });

  it("does not submit empty text input", () => {
    const onSubmit = vi.fn();
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("prompt-send-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("SEND button is disabled when input is empty", () => {
    render(<AgentPromptPopup {...defaultProps} promptType="text_input" />);
    expect(screen.getByTestId("prompt-send-btn")).toBeDisabled();
  });
});
