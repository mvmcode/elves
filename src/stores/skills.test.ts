/* Tests for the skills store — verifies defaults and CRUD actions. */

import { describe, expect, it, beforeEach } from "vitest";
import { useSkillStore } from "./skills";
import type { Skill } from "@/types/skill";

function createTestSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: "skill-1",
    projectId: null,
    name: "Test Skill",
    description: "A test skill",
    content: "## Instructions\nDo the thing.",
    triggerPattern: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function resetStore(): void {
  useSkillStore.setState({ skills: [], activeSkillId: null, isLoading: false });
}

describe("useSkillStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("defaults", () => {
    it("starts with empty skills", () => {
      expect(useSkillStore.getState().skills).toEqual([]);
    });

    it("starts with no active skill", () => {
      expect(useSkillStore.getState().activeSkillId).toBeNull();
    });

    it("starts not loading", () => {
      expect(useSkillStore.getState().isLoading).toBe(false);
    });
  });

  describe("setSkills", () => {
    it("replaces the skill list", () => {
      useSkillStore.getState().setSkills([createTestSkill(), createTestSkill({ id: "skill-2" })]);
      expect(useSkillStore.getState().skills).toHaveLength(2);
    });
  });

  describe("setActiveSkillId", () => {
    it("sets the active skill", () => {
      useSkillStore.getState().setActiveSkillId("skill-1");
      expect(useSkillStore.getState().activeSkillId).toBe("skill-1");
    });

    it("clears the active skill", () => {
      useSkillStore.getState().setActiveSkillId("skill-1");
      useSkillStore.getState().setActiveSkillId(null);
      expect(useSkillStore.getState().activeSkillId).toBeNull();
    });
  });

  describe("addSkill", () => {
    it("appends skill and selects it", () => {
      const skill = createTestSkill();
      useSkillStore.getState().addSkill(skill);
      expect(useSkillStore.getState().skills).toHaveLength(1);
      expect(useSkillStore.getState().activeSkillId).toBe("skill-1");
    });
  });

  describe("updateSkill", () => {
    it("updates a skill by ID", () => {
      useSkillStore.getState().setSkills([createTestSkill()]);
      useSkillStore.getState().updateSkill("skill-1", createTestSkill({ name: "Updated" }));
      expect(useSkillStore.getState().skills[0]?.name).toBe("Updated");
    });
  });

  describe("removeSkill", () => {
    it("removes a skill by ID", () => {
      useSkillStore.getState().setSkills([
        createTestSkill({ id: "skill-1" }),
        createTestSkill({ id: "skill-2" }),
      ]);
      useSkillStore.getState().removeSkill("skill-1");
      expect(useSkillStore.getState().skills).toHaveLength(1);
    });

    it("clears activeSkillId if removed skill was active", () => {
      useSkillStore.getState().setSkills([createTestSkill()]);
      useSkillStore.getState().setActiveSkillId("skill-1");
      useSkillStore.getState().removeSkill("skill-1");
      expect(useSkillStore.getState().activeSkillId).toBeNull();
    });

    it("keeps activeSkillId if another skill was active", () => {
      useSkillStore.getState().setSkills([
        createTestSkill({ id: "skill-1" }),
        createTestSkill({ id: "skill-2" }),
      ]);
      useSkillStore.getState().setActiveSkillId("skill-2");
      useSkillStore.getState().removeSkill("skill-1");
      expect(useSkillStore.getState().activeSkillId).toBe("skill-2");
    });
  });
});
