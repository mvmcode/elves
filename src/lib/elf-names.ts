/* Elf personality engine — assigns names, avatars, colors, and funny status messages to agents. */

import type { ElfPersonality, ElfStatus, StatusMessageMap } from "@/types/elf";
import type { AvatarId } from "@/components/theater/ElfAvatar";

/** Pool of elf names for the workshop */
const ELF_NAMES: readonly string[] = [
  "Spark", "Tinker", "Jingle", "Sprocket", "Nimble", "Flicker", "Bramble", "Thistle",
  "Cobalt", "Pip", "Fern", "Maple", "Cricket", "Rune", "Ember",
] as const;

/** Avatar emoji for each elf, indexed to match ELF_NAMES */
const ELF_AVATARS: readonly string[] = [
  "⚡", "🔧", "🔔", "⚙️", "🏃", "🕯️", "🌿", "🌸",
  "💎", "🐦", "🍃", "🍁", "🦗", "✨", "🔥",
] as const;

/** SVG avatar ID for each elf, indexed to match ELF_NAMES */
const ELF_AVATAR_IDS: readonly AvatarId[] = [
  "spark", "tinker", "jingle", "sprocket", "nimble",
  "flicker", "bramble", "thistle", "cobalt", "pip",
  "fern", "maple", "cricket", "rune", "ember",
] as const;

/** Distinct neo-brutalist accent color for each elf, indexed to match ELF_NAMES */
const ELF_COLORS: readonly string[] = [
  "#FFD93D", "#FF6B6B", "#6BCB77", "#4D96FF", "#FF8B3D",
  "#E879F9", "#34D399", "#F97316", "#A78BFA", "#FB923C",
  "#38BDF8", "#FB7185", "#FACC15", "#2DD4BF", "#C084FC",
] as const;

/** Quirky personality trait for each elf */
const ELF_QUIRKS: readonly string[] = [
  "Leaves glitter on every file they touch",
  "Talks to their tools like old friends",
  "Hums jingle bells while refactoring",
  "Insists every function needs more gears",
  "Moves so fast they blur in the terminal",
  "Lights a candle before every debug session",
  "Weaves thorny branches into error messages",
  "Presses wildflowers between pages of docs",
  "Polishes every variable name to a shine",
  "Chirps excitedly when tests pass",
  "Grows tiny ferns in the margins of code",
  "Collects autumn leaves shaped like semicolons",
  "Serenades bugs out of the codebase",
  "Carves mysterious symbols into commit messages",
  "Forges code in a tiny furnace",
] as const;

/** Funny status messages for each operational state, with {name} as a template variable */
const STATUS_MESSAGES: StatusMessageMap = {
  spawning: [
    "{name} is emerging from the workshop...",
    "{name} is dusting off their toolkit...",
    "{name} is putting on their pointy hat...",
    "{name} just arrived from the North Pole!",
  ],
  working: [
    "{name} is hammering away at the workbench...",
    "{name} is in the workshop zone — do not disturb!",
    "{name} is crafting code with tiny precise hands...",
    "{name} is making toys... er, features...",
  ],
  thinking: [
    "{name} is consulting the ancient scrolls...",
    "{name} is rubbing their pointy ears thoughtfully...",
    "{name} asked for silence while they ponder...",
    "{name} is having a deep workshop epiphany...",
  ],
  waiting: [
    "{name} is nibbling on a cookie while they wait... 🍪",
    "{name} is waiting patiently (for once)...",
    "{name} is doing stretches while they wait...",
    "{name} is polishing their tools out of habit...",
  ],
  chatting: [
    "{name} is exchanging workshop gossip with the team...",
    "{name} is in a heated debate about tabs vs spaces...",
    "{name} is sharing cookie recipes in the group chat... 🍪",
    "{name} is whispering secrets to the other elves...",
  ],
  done: [
    "{name} drops the wrench and takes a bow!",
    "{name} is doing a victory jig!",
    "{name} just saved the workshop, no big deal...",
    "{name} has finished and is accepting cookies! 🍪",
  ],
  error: [
    "{name} just tripped over a toolbox...",
    "{name} is blaming mischievous sprites...",
    "{name} encountered a gremlin in the gears!",
    "{name} is staring at the blueprints in disbelief...",
  ],
  sleeping: [
    "{name} is snoring quietly in the workshop corner...",
    "{name} has entered power-saving mode...",
    "{name} is dreaming about clean code and cookies... 🍪",
    "{name} is taking a well-deserved nap by the fireplace...",
  ],
};

/**
 * Returns a random personality that hasn't been used yet in this session.
 * If all names are taken, wraps around with a numeric suffix.
 * @param usedNames - Names already assigned in the current session
 */
export function generateElf(usedNames?: readonly string[]): ElfPersonality {
  const used = new Set(usedNames ?? []);
  const available = ELF_NAMES.filter((name) => !used.has(name));

  if (available.length > 0) {
    const index = Math.floor(Math.random() * available.length);
    const name = available[index]!;
    const originalIndex = ELF_NAMES.indexOf(name);
    return {
      name,
      avatar: ELF_AVATARS[originalIndex]!,
      avatarId: ELF_AVATAR_IDS[originalIndex]!,
      color: ELF_COLORS[originalIndex]!,
      quirk: ELF_QUIRKS[originalIndex]!,
    };
  }

  /* All names used — pick a random base name with a numeric suffix */
  const baseIndex = Math.floor(Math.random() * ELF_NAMES.length);
  const baseName = ELF_NAMES[baseIndex]!;
  let suffix = 2;
  while (used.has(`${baseName} ${suffix}`)) {
    suffix++;
  }
  return {
    name: `${baseName} ${suffix}`,
    avatar: ELF_AVATARS[baseIndex]!,
    avatarId: ELF_AVATAR_IDS[baseIndex]!,
    color: ELF_COLORS[baseIndex]!,
    quirk: ELF_QUIRKS[baseIndex]!,
  };
}

/**
 * Returns a random funny status message for the given name and status.
 * Replaces the {name} template variable with the actual elf name.
 * @param name - The elf's display name
 * @param status - The current operational status
 */
export function getStatusMessage(name: string, status: ElfStatus): string {
  const messages = STATUS_MESSAGES[status];
  const index = Math.floor(Math.random() * messages.length);
  return messages[index]!.replace("{name}", name);
}

/**
 * Returns the avatar emoji for a known elf name.
 * Falls back to a default emoji for unknown or suffixed names.
 * @param name - The elf's display name
 */
export function getAvatar(name: string): string {
  const index = ELF_NAMES.indexOf(name);
  if (index !== -1) {
    return ELF_AVATARS[index]!;
  }
  /* Handle suffixed names like "Spark 2" by extracting the base name */
  const baseName = name.replace(/\s+\d+$/, "");
  const baseIndex = ELF_NAMES.indexOf(baseName);
  return baseIndex !== -1 ? ELF_AVATARS[baseIndex]! : "🤖";
}

/**
 * Returns the accent color for a known elf name.
 * Falls back to elf gold for unknown or suffixed names.
 * @param name - The elf's display name
 */
export function getColor(name: string): string {
  const index = ELF_NAMES.indexOf(name);
  if (index !== -1) {
    return ELF_COLORS[index]!;
  }
  /* Handle suffixed names like "Spark 2" by extracting the base name */
  const baseName = name.replace(/\s+\d+$/, "");
  const baseIndex = ELF_NAMES.indexOf(baseName);
  return baseIndex !== -1 ? ELF_COLORS[baseIndex]! : "#FFD93D";
}
