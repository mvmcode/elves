/* Tests for ElfAvatar — verifies rendering, all avatars, animation classes, sizes, and name mapping. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  ElfAvatar,
  ALL_AVATAR_IDS,
  ELF_NAME_TO_AVATAR,
  getAvatarId,
  type AvatarSize,
} from "./ElfAvatar";
import type { ElfStatus } from "@/types/elf";

const ALL_STATUSES: readonly ElfStatus[] = [
  "spawning", "working", "thinking", "waiting",
  "chatting", "done", "error", "sleeping",
] as const;

const ALL_SIZES: readonly AvatarSize[] = ["sm", "md", "lg", "xl"] as const;

describe("ElfAvatar", () => {
  it("renders an SVG element", () => {
    render(<ElfAvatar avatarId="spark" status="working" />);
    const avatar = screen.getByTestId("elf-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar.querySelector("svg")).toBeInTheDocument();
  });

  it.each(ALL_AVATAR_IDS)("renders avatar '%s' without errors", (avatarId) => {
    render(<ElfAvatar avatarId={avatarId} status="working" />);
    const avatar = screen.getByTestId("elf-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar.getAttribute("data-avatar-id")).toBe(avatarId);
  });

  it("has exactly 15 avatar IDs", () => {
    expect(ALL_AVATAR_IDS.length).toBe(15);
  });

  it("applies the correct animation class for each status", () => {
    const expectedClasses: Record<ElfStatus, string> = {
      spawning: "elf-anim-idle",
      working: "elf-anim-working",
      thinking: "elf-anim-thinking",
      waiting: "elf-anim-idle",
      chatting: "elf-anim-idle",
      done: "elf-anim-done",
      error: "elf-anim-error",
      sleeping: "elf-anim-sleeping",
    };

    for (const status of ALL_STATUSES) {
      const { unmount } = render(<ElfAvatar avatarId="spark" status={status} />);
      const avatar = screen.getByTestId("elf-avatar");
      expect(avatar.className).toContain(expectedClasses[status]);
      unmount();
    }
  });

  it("sets data-status attribute correctly", () => {
    render(<ElfAvatar avatarId="tinker" status="error" />);
    expect(screen.getByTestId("elf-avatar").getAttribute("data-status")).toBe("error");
  });

  it.each(ALL_SIZES)("renders at correct pixel size for '%s'", (size) => {
    const sizeMap: Record<AvatarSize, number> = { sm: 32, md: 48, lg: 80, xl: 120 };
    render(<ElfAvatar avatarId="spark" status="working" size={size} />);
    const avatar = screen.getByTestId("elf-avatar");
    expect(avatar.style.width).toBe(`${sizeMap[size]}px`);
    expect(avatar.style.height).toBe(`${sizeMap[size]}px`);
  });

  it("defaults to 'md' size when not specified", () => {
    render(<ElfAvatar avatarId="spark" status="working" />);
    const avatar = screen.getByTestId("elf-avatar");
    expect(avatar.style.width).toBe("48px");
  });

  it("applies custom color to the base shape", () => {
    render(<ElfAvatar avatarId="spark" status="working" color="#FF6B6B" />);
    const svg = screen.getByTestId("elf-avatar").querySelector("svg");
    const circle = svg?.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("#FF6B6B");
  });

  it("has an accessible label on the SVG", () => {
    render(<ElfAvatar avatarId="rune" status="thinking" />);
    const svg = screen.getByTestId("elf-avatar").querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toBe("Elf avatar: rune");
  });
});

describe("ELF_NAME_TO_AVATAR", () => {
  it("maps all 15 elf names to avatar IDs", () => {
    expect(Object.keys(ELF_NAME_TO_AVATAR).length).toBe(15);
  });

  it("maps Spark to spark", () => {
    expect(ELF_NAME_TO_AVATAR["Spark"]).toBe("spark");
  });

  it("maps Ember to ember", () => {
    expect(ELF_NAME_TO_AVATAR["Ember"]).toBe("ember");
  });
});

describe("getAvatarId", () => {
  it("returns correct ID for known names", () => {
    expect(getAvatarId("Spark")).toBe("spark");
    expect(getAvatarId("Rune")).toBe("rune");
  });

  it("handles suffixed names", () => {
    expect(getAvatarId("Spark 2")).toBe("spark");
    expect(getAvatarId("Tinker 3")).toBe("tinker");
  });

  it("falls back to spark for unknown names", () => {
    expect(getAvatarId("Unknown Agent")).toBe("spark");
  });
});
