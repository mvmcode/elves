/* Tests for McpManager — verifies card grid, toggle, add form, and empty state. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpManager } from "./McpManager";
import { useMcpStore } from "@/stores/mcp";
import type { McpServer } from "@/types/mcp";

/* Mock MCP actions to prevent IPC calls */
const mockToggle = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/hooks/useMcpActions", () => ({
  useMcpActions: () => ({
    loadServers: vi.fn(),
    handleAddServer: vi.fn(),
    handleToggleServer: mockToggle,
    handleHealthCheck: vi.fn().mockResolvedValue(true),
    handleImportFromClaude: vi.fn().mockResolvedValue(0),
    handleDeleteServer: mockDelete,
  }),
}));

function createTestServer(overrides?: Partial<McpServer>): McpServer {
  return {
    id: "mcp-1",
    name: "GitHub Server",
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    env: "",
    scope: "global",
    enabled: true,
    lastHealthCheck: null,
    ...overrides,
  };
}

describe("McpManager", () => {
  beforeEach(() => {
    useMcpStore.setState({ servers: [], isLoading: false });
    mockToggle.mockClear();
    mockDelete.mockClear();
  });

  it("renders the MCP manager container", () => {
    render(<McpManager />);
    expect(screen.getByTestId("mcp-manager")).toBeInTheDocument();
  });

  it("shows empty state when no servers configured", () => {
    render(<McpManager />);
    expect(screen.getByTestId("mcp-empty")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    useMcpStore.setState({ isLoading: true });
    render(<McpManager />);
    expect(screen.getByText("Loading MCP servers...")).toBeInTheDocument();
  });

  it("renders server cards", () => {
    useMcpStore.setState({
      servers: [createTestServer(), createTestServer({ id: "mcp-2", name: "Slack Server" })],
    });
    render(<McpManager />);
    const cards = screen.getAllByTestId("mcp-server-card");
    expect(cards).toHaveLength(2);
  });

  it("shows server name", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    expect(screen.getByText("GitHub Server")).toBeInTheDocument();
  });

  it("shows command in card", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    expect(screen.getByText("npx -y @modelcontextprotocol/server-github")).toBeInTheDocument();
  });

  it("shows scope badge", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    expect(screen.getByText("global")).toBeInTheDocument();
  });

  it("shows toggle switch", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    const toggle = screen.getByTestId("mcp-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("calls toggle when switch is clicked", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    fireEvent.click(screen.getByTestId("mcp-toggle"));
    expect(mockToggle).toHaveBeenCalledWith("mcp-1", false);
  });

  it("shows Health Check button", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    expect(screen.getByText("Check")).toBeInTheDocument();
  });

  it("shows delete button on cards", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    expect(screen.getByText("×")).toBeInTheDocument();
  });

  it("opens add form when + Add Server is clicked", () => {
    render(<McpManager />);
    expect(screen.queryByTestId("mcp-add-form")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("+ Add Server"));
    expect(screen.getByTestId("mcp-add-form")).toBeInTheDocument();
  });

  it("shows add form fields", () => {
    render(<McpManager />);
    fireEvent.click(screen.getByText("+ Add Server"));
    expect(screen.getByTestId("mcp-add-name")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-add-command")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-add-args")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-add-env")).toBeInTheDocument();
  });

  it("shows Import from Claude button", () => {
    render(<McpManager />);
    expect(screen.getByText("Import from Claude")).toBeInTheDocument();
  });

  it("shows status dot on each card", () => {
    useMcpStore.setState({ servers: [createTestServer()] });
    render(<McpManager />);
    expect(screen.getByTestId("mcp-status-dot")).toBeInTheDocument();
  });

  it("reduces opacity for disabled servers", () => {
    useMcpStore.setState({ servers: [createTestServer({ enabled: false })] });
    render(<McpManager />);
    const card = screen.getByTestId("mcp-server-card");
    expect(card.className).toContain("opacity-60");
  });
});
