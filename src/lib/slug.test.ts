/* Tests for workspace slug generator. */

import { describe, it, expect } from "vitest";
import { generateWorkspaceSlug } from "./slug";

describe("generateWorkspaceSlug", () => {
  it("generates a slug from a task description", () => {
    const slug = generateWorkspaceSlug("Fix the login button styling");
    expect(slug).toMatch(/^fix-login-button-styling-[a-z0-9]{4}$/);
  });

  it("strips stop words", () => {
    const slug = generateWorkspaceSlug("Add a new feature to the dashboard");
    expect(slug).toMatch(/^add-new-feature-dashboard-[a-z0-9]{4}$/);
  });

  it("limits to 4 meaningful words", () => {
    const slug = generateWorkspaceSlug("Refactor auth setup config");
    /* 4 words + 1 suffix = 5 parts */
    expect(slug).toMatch(/^refactor-auth-setup-config-[a-z0-9]{4}$/);
  });

  it("handles empty/stop-word-only input", () => {
    const slug = generateWorkspaceSlug("the a an");
    expect(slug).toMatch(/^task-[a-z0-9]{4}$/);
  });

  it("strips special characters", () => {
    const slug = generateWorkspaceSlug("Fix bug #123 in user's profile!");
    expect(slug).not.toMatch(/[#!']/);
  });

  it("caps at 40 characters", () => {
    const slug = generateWorkspaceSlug(
      "Implement comprehensive internationalization localization support across entire application",
    );
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it("lowercases everything", () => {
    const slug = generateWorkspaceSlug("UPDATE User Profile Component");
    expect(slug).toBe(slug.toLowerCase());
  });

  it("generates unique suffixes", () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 20; i++) {
      slugs.add(generateWorkspaceSlug("same task"));
    }
    /* With 4-char random suffix, collisions in 20 runs are extremely unlikely */
    expect(slugs.size).toBeGreaterThan(1);
  });
});
