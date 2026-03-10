/* Tests for McpCatalog — verifies catalog rendering, search filtering, category chips, and install. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpCatalog } from "./McpCatalog";
import { useMcpStore } from "@/stores/mcp";
import type { McpCatalogItem } from "@/types/mcp";

const mockLoadCatalog = vi.fn().mockResolvedValue(undefined);
const mockSearch = vi.fn().mockResolvedValue(undefined);
const mockInstallFromSearch = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useMcpActions", () => ({
  useMcpActions: () => ({
    loadServers: vi.fn(),
    handleAddServer: vi.fn(),
    handleToggleServer: vi.fn(),
    handleHealthCheck: vi.fn().mockResolvedValue(true),
    handleImportFromClaude: vi.fn().mockResolvedValue({ imported: 0, scanned: 0 }),
    handleDeleteServer: vi.fn(),
    handleSearch: mockSearch,
    handleInstallFromSearch: mockInstallFromSearch,
    handleLoadCatalog: mockLoadCatalog,
  }),
}));

function createCatalogItem(overrides?: Partial<McpCatalogItem>): McpCatalogItem {
  return {
    id: "catalog-github",
    name: "GitHub",
    description: "Repository management, issues, PRs, and code search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    category: "Developer Tools",
    sourceUrl: "https://github.com/modelcontextprotocol/servers",
    envKeys: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    ...overrides,
  };
}

describe("McpCatalog", () => {
  beforeEach(() => {
    useMcpStore.setState({
      catalogItems: [],
      catalogSearchQuery: "",
      catalogCategoryFilter: null,
      servers: [],
      searchResults: [],
      isSearching: false,
    });
    mockLoadCatalog.mockClear();
    mockSearch.mockClear();
    mockInstallFromSearch.mockClear();
  });

  it("renders the catalog container", () => {
    render(<McpCatalog />);
    expect(screen.getByTestId("mcp-catalog")).toBeInTheDocument();
  });

  it("calls handleLoadCatalog on mount", () => {
    render(<McpCatalog />);
    expect(mockLoadCatalog).toHaveBeenCalledTimes(1);
  });

  it("renders catalog items from store", () => {
    useMcpStore.setState({
      catalogItems: [
        createCatalogItem(),
        createCatalogItem({ id: "catalog-slack", name: "Slack", category: "Communication" }),
      ],
    });
    render(<McpCatalog />);
    const items = screen.getAllByTestId("mcp-catalog-item");
    expect(items).toHaveLength(2);
  });

  it("shows search input", () => {
    render(<McpCatalog />);
    expect(screen.getByTestId("mcp-catalog-search")).toBeInTheDocument();
  });

  it("filters items by search query", () => {
    useMcpStore.setState({
      catalogItems: [
        createCatalogItem(),
        createCatalogItem({ id: "catalog-slack", name: "Slack", category: "Communication" }),
      ],
      catalogSearchQuery: "github",
    });
    render(<McpCatalog />);
    const items = screen.getAllByTestId("mcp-catalog-item");
    expect(items).toHaveLength(1);
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("renders category chips", () => {
    useMcpStore.setState({
      catalogItems: [
        createCatalogItem(),
        createCatalogItem({ id: "catalog-slack", name: "Slack", category: "Communication" }),
      ],
    });
    render(<McpCatalog />);
    expect(screen.getByTestId("mcp-catalog-categories")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
    const chips = screen.getAllByTestId("mcp-catalog-category-chip");
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });

  it("filters items by category when chip is clicked", () => {
    useMcpStore.setState({
      catalogItems: [
        createCatalogItem(),
        createCatalogItem({ id: "catalog-slack", name: "Slack", category: "Communication" }),
      ],
    });
    render(<McpCatalog />);
    const chips = screen.getAllByTestId("mcp-catalog-category-chip");
    const commChip = chips.find((chip) => chip.textContent === "Communication");
    expect(commChip).toBeDefined();
    fireEvent.click(commChip!);
    const items = screen.getAllByTestId("mcp-catalog-item");
    expect(items).toHaveLength(1);
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("shows install button for each catalog item", () => {
    useMcpStore.setState({
      catalogItems: [createCatalogItem()],
    });
    render(<McpCatalog />);
    expect(screen.getByTestId("mcp-catalog-install")).toBeInTheDocument();
    expect(screen.getByText("Install")).toBeInTheDocument();
  });

  it("shows env key badges", () => {
    useMcpStore.setState({
      catalogItems: [createCatalogItem()],
    });
    render(<McpCatalog />);
    expect(screen.getByText("GITHUB_PERSONAL_ACCESS_TOKEN")).toBeInTheDocument();
  });

  it("shows Installed state for servers already configured", () => {
    useMcpStore.setState({
      catalogItems: [createCatalogItem()],
      servers: [
        {
          id: "mcp-1",
          name: "GitHub",
          command: "npx",
          args: "-y @modelcontextprotocol/server-github",
          env: "",
          scope: "global",
          enabled: true,
          lastHealthCheck: null,
        },
      ],
    });
    render(<McpCatalog />);
    expect(screen.getByText("Installed")).toBeInTheDocument();
  });
});
