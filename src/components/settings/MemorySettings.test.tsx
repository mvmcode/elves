/* Tests for MemorySettings — verifies rendering, toggle, clear confirmation, and control updates. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemorySettings } from "./MemorySettings";
import { useSettingsStore } from "@/stores/settings";

/** Reset settings store between tests */
function resetStore(): void {
  useSettingsStore.setState({
    autoLearn: true,
    decayRate: "normal",
    maxMemoriesPerProject: 500,
    maxContextInjection: 20,
  });
}

describe("MemorySettings", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renders the settings container", () => {
    render(<MemorySettings />);
    expect(screen.getByTestId("memory-settings")).toBeInTheDocument();
  });

  it("renders the Memory Settings heading", () => {
    render(<MemorySettings />);
    expect(screen.getByText("Memory Settings")).toBeInTheDocument();
  });

  it("renders the auto-learn toggle", () => {
    render(<MemorySettings />);
    expect(screen.getByTestId("auto-learn-toggle")).toBeInTheDocument();
  });

  it("toggles auto-learn off when clicked", () => {
    render(<MemorySettings />);
    const toggle = screen.getByTestId("auto-learn-toggle");

    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(useSettingsStore.getState().autoLearn).toBe(false);
  });

  it("toggles auto-learn back on", () => {
    useSettingsStore.setState({ autoLearn: false });
    render(<MemorySettings />);
    const toggle = screen.getByTestId("auto-learn-toggle");

    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(useSettingsStore.getState().autoLearn).toBe(true);
  });

  it("renders the decay rate select with correct default", () => {
    render(<MemorySettings />);
    const select = screen.getByTestId("decay-rate-select") as HTMLSelectElement;
    expect(select.value).toBe("normal");
  });

  it("changes decay rate on selection", () => {
    render(<MemorySettings />);
    const select = screen.getByTestId("decay-rate-select");
    fireEvent.change(select, { target: { value: "fast" } });
    expect(useSettingsStore.getState().decayRate).toBe("fast");
  });

  it("renders the max memories input with default value", () => {
    render(<MemorySettings />);
    const input = screen.getByTestId("max-memories-input") as HTMLInputElement;
    expect(input.value).toBe("500");
  });

  it("updates max memories on change", () => {
    render(<MemorySettings />);
    const input = screen.getByTestId("max-memories-input");
    fireEvent.change(input, { target: { value: "1000" } });
    expect(useSettingsStore.getState().maxMemoriesPerProject).toBe(1000);
  });

  it("renders the max context input with default value", () => {
    render(<MemorySettings />);
    const input = screen.getByTestId("max-context-input") as HTMLInputElement;
    expect(input.value).toBe("20");
  });

  it("updates max context injection on change", () => {
    render(<MemorySettings />);
    const input = screen.getByTestId("max-context-input");
    fireEvent.change(input, { target: { value: "50" } });
    expect(useSettingsStore.getState().maxContextInjection).toBe(50);
  });

  it("renders the clear all button", () => {
    render(<MemorySettings />);
    expect(screen.getByTestId("clear-all-button")).toBeInTheDocument();
  });

  it("shows confirmation when clear all is clicked", () => {
    render(<MemorySettings />);
    fireEvent.click(screen.getByTestId("clear-all-button"));
    expect(screen.getByTestId("clear-confirm")).toBeInTheDocument();
    expect(screen.getByText(/Delete all memories/)).toBeInTheDocument();
  });

  it("fires onClearAll when confirmation is accepted", () => {
    const onClearAll = vi.fn();
    render(<MemorySettings onClearAll={onClearAll} />);

    fireEvent.click(screen.getByTestId("clear-all-button"));
    fireEvent.click(screen.getByTestId("clear-confirm-yes"));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("cancels clear when No is clicked", () => {
    const onClearAll = vi.fn();
    render(<MemorySettings onClearAll={onClearAll} />);

    fireEvent.click(screen.getByTestId("clear-all-button"));
    fireEvent.click(screen.getByTestId("clear-confirm-no"));
    expect(onClearAll).not.toHaveBeenCalled();
    expect(screen.queryByTestId("clear-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId("clear-all-button")).toBeInTheDocument();
  });

  it("renders the export button", () => {
    render(<MemorySettings />);
    expect(screen.getByTestId("export-button")).toBeInTheDocument();
  });

  it("fires onExport when export button is clicked", () => {
    const onExport = vi.fn();
    render(<MemorySettings onExport={onExport} />);
    fireEvent.click(screen.getByTestId("export-button"));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("renders the import button", () => {
    render(<MemorySettings />);
    expect(screen.getByTestId("import-button")).toBeInTheDocument();
  });

  it("fires onImport when import button is clicked", () => {
    const onImport = vi.fn();
    render(<MemorySettings onImport={onImport} />);
    fireEvent.click(screen.getByTestId("import-button"));
    expect(onImport).toHaveBeenCalledOnce();
  });
});
