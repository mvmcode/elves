/* Tests for SkillManager — verifies tab rendering and switching. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillManager } from "./SkillManager";
import { useAppStore } from "@/stores/app";

/* Mock Tauri IPC */
vi.mock("@/lib/tauri", () => ({
  listSkillSources: vi.fn().mockResolvedValue([]),
  listAllCatalogSkills: vi.fn().mockResolvedValue([]),
  searchGithubCatalog: vi.fn().mockResolvedValue([]),
  writeTextToFile: vi.fn().mockResolvedValue(undefined),
}));

/* Mock skill actions */
vi.mock("@/hooks/useSkillActions", () => ({
  useSkillActions: () => ({
    loadSkills: vi.fn(),
    handleCreateSkill: vi.fn(),
    handleUpdateSkill: vi.fn(),
    handleDeleteSkill: vi.fn(),
    handleImportFromClaude: vi.fn().mockResolvedValue(0),
    handleSearchV2: vi.fn(),
    handleToggleSkill: vi.fn(),
    handleRefreshCatalog: vi.fn().mockResolvedValue(undefined),
    handleLoadCatalog: vi.fn().mockResolvedValue(undefined),
    handlePreviewSkill: vi.fn(),
    handleInstallSkill: vi.fn(),
  }),
}));

/* Mock team session */
vi.mock("@/hooks/useTeamSession", () => ({
  useTeamSession: () => ({
    analyzeAndDeploy: vi.fn(),
  }),
}));

/* Mock dialog plugin */
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

/* Mock opener plugin */
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("SkillManager", () => {
  beforeEach(() => {
    useAppStore.setState({ defaultRuntime: "claude-code" });
  });

  it("renders both My Skills and Catalog tab buttons", () => {
    render(<SkillManager />);
    // "My Skills" appears as both a tab button and a sidebar heading
    const mySkillsElements = screen.getAllByText("My Skills");
    expect(mySkillsElements.length).toBeGreaterThanOrEqual(2); // tab button + sidebar h2
    expect(screen.getByText("Catalog")).toBeInTheDocument();
  });

  it("shows My Skills tab as active by default", () => {
    render(<SkillManager />);
    expect(screen.getByTestId("skill-manager")).toBeInTheDocument();
    // SkillSidebar heading confirms "My Skills" content is active
    expect(screen.getByText("My Skills", { selector: "h2" })).toBeInTheDocument();
  });

  it("switches to Catalog tab when clicked", () => {
    render(<SkillManager />);
    const catalogTab = screen.getByText("Catalog");
    fireEvent.click(catalogTab);
    // Catalog content: SkillCatalog contains "Skill Catalog" heading
    expect(screen.getByText("Skill Catalog")).toBeInTheDocument();
  });

  it("shows coming soon message for Codex runtime", () => {
    useAppStore.setState({ defaultRuntime: "codex" });
    render(<SkillManager />);
    expect(screen.getByTestId("skill-editor-unsupported")).toBeInTheDocument();
    expect(screen.queryByText("Catalog")).not.toBeInTheDocument();
  });
});
