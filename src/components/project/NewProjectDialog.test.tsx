/* Tests for the NewProjectDialog component. */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewProjectDialog } from "./NewProjectDialog";

/* Mock the Tauri dialog plugin */
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

/* Mock the Tauri IPC layer */
vi.mock("@/lib/tauri", () => ({
  createProject: vi.fn(),
}));

/* Mock the project store */
const mockAddProject = vi.fn();
vi.mock("@/stores/project", () => ({
  useProjectStore: (selector: (state: { addProject: typeof mockAddProject }) => unknown) =>
    selector({ addProject: mockAddProject }),
}));

import { createProject } from "@/lib/tauri";
import { open } from "@tauri-apps/plugin-dialog";

const mockCreateProject = vi.mocked(createProject);
const mockOpen = vi.mocked(open);

describe("NewProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form when open", () => {
    render(<NewProjectDialog isOpen onClose={vi.fn()} />);
    expect(screen.getByText("New Project")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Path")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<NewProjectDialog isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText("New Project")).not.toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    render(<NewProjectDialog isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("Project name is required.")).toBeInTheDocument();
    });
  });

  it("shows validation error when path is empty", async () => {
    render(<NewProjectDialog isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Test Project" },
    });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("Project path is required.")).toBeInTheDocument();
    });
  });

  it("calls createProject and addProject on valid submit", async () => {
    const mockProject = {
      id: "p1",
      name: "Test",
      path: "/tmp/test",
      defaultRuntime: "claude-code" as const,
      createdAt: 1700000000,
      updatedAt: 1700000000,
      settings: {},
    };
    mockCreateProject.mockResolvedValueOnce(mockProject);
    const handleClose = vi.fn();

    render(<NewProjectDialog isOpen onClose={handleClose} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText("Path"), {
      target: { value: "/tmp/test" },
    });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith("Test", "/tmp/test");
      expect(mockAddProject).toHaveBeenCalledWith(mockProject);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("displays error when createProject fails", async () => {
    mockCreateProject.mockRejectedValueOnce(new Error("Path not found"));

    render(<NewProjectDialog isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Failing" },
    });
    fireEvent.change(screen.getByLabelText("Path"), {
      target: { value: "/bad/path" },
    });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(screen.getByText("Path not found")).toBeInTheDocument();
    });
  });

  it("calls native folder picker on Browse click", async () => {
    mockOpen.mockResolvedValueOnce("/selected/path" as ReturnType<typeof open> extends Promise<infer T> ? T : never);

    render(<NewProjectDialog isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Browse"));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({ directory: true, multiple: false });
    });
  });

  it("calls onClose when Cancel is clicked", () => {
    const handleClose = vi.fn();
    render(<NewProjectDialog isOpen onClose={handleClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(handleClose).toHaveBeenCalledOnce();
  });
});
