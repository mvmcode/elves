/* Tests for the template store — verifies defaults and CRUD actions. */

import { describe, expect, it, beforeEach } from "vitest";
import { useTemplateStore } from "./templates";
import type { Template } from "@/types/template";

function createTestTemplate(overrides?: Partial<Template>): Template {
  return {
    id: "tmpl-1",
    name: "Test Template",
    description: "A test template",
    plan: {
      complexity: "team",
      agentCount: 2,
      roles: [{ name: "Lead", focus: "Coordination", runtime: "claude-code" }],
      taskGraph: [],
      runtimeRecommendation: "claude-code",
      estimatedDuration: "5 min",
    },
    builtIn: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

function resetStore(): void {
  useTemplateStore.setState({ templates: [], isLoading: false });
}

describe("useTemplateStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("defaults", () => {
    it("starts with empty templates", () => {
      expect(useTemplateStore.getState().templates).toEqual([]);
    });

    it("starts not loading", () => {
      expect(useTemplateStore.getState().isLoading).toBe(false);
    });
  });

  describe("setTemplates", () => {
    it("replaces the template list", () => {
      const templates = [createTestTemplate(), createTestTemplate({ id: "tmpl-2", name: "Other" })];
      useTemplateStore.getState().setTemplates(templates);
      expect(useTemplateStore.getState().templates).toHaveLength(2);
    });
  });

  describe("addTemplate", () => {
    it("appends a template", () => {
      const template = createTestTemplate();
      useTemplateStore.getState().addTemplate(template);
      expect(useTemplateStore.getState().templates).toHaveLength(1);
      expect(useTemplateStore.getState().templates[0]?.name).toBe("Test Template");
    });
  });

  describe("removeTemplate", () => {
    it("removes a template by ID", () => {
      useTemplateStore.getState().setTemplates([
        createTestTemplate({ id: "tmpl-1" }),
        createTestTemplate({ id: "tmpl-2", name: "Keep" }),
      ]);
      useTemplateStore.getState().removeTemplate("tmpl-1");
      expect(useTemplateStore.getState().templates).toHaveLength(1);
      expect(useTemplateStore.getState().templates[0]?.id).toBe("tmpl-2");
    });
  });

  describe("setLoading", () => {
    it("updates loading state", () => {
      useTemplateStore.getState().setLoading(true);
      expect(useTemplateStore.getState().isLoading).toBe(true);
    });
  });
});
