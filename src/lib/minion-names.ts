/* Minion personality engine — assigns names, avatars, colors, and funny status messages to agents. */

import type { MinionPersonality, MinionStatus, StatusMessageMap } from "@/types/minion";

/** Pool of minion names from the product vision */
const MINION_NAMES: readonly string[] = [
  "Gru Jr.", "Kevin", "Stuart", "Bob", "Otto", "Dave", "Jerry", "Phil",
  "Norbert", "Jorge", "Carl", "Tim", "Mark", "Lance", "Steve",
] as const;

/** Avatar emoji for each minion, indexed to match MINION_NAMES */
const MINION_AVATARS: readonly string[] = [
  "👷", "🔬", "🤓", "🎧", "🕵️", "👨‍🍳", "🧑‍🔧", "📐",
  "🎨", "🏋️", "🧪", "⚡", "🎯", "🗡️", "🛡️",
] as const;

/** Distinct neo-brutalist accent color for each minion, indexed to match MINION_NAMES */
const MINION_COLORS: readonly string[] = [
  "#FFD93D", "#FF6B6B", "#6BCB77", "#4D96FF", "#FF8B3D",
  "#E879F9", "#34D399", "#F97316", "#A78BFA", "#FB923C",
  "#38BDF8", "#FB7185", "#FACC15", "#2DD4BF", "#C084FC",
] as const;

/** Quirky personality trait for each minion */
const MINION_QUIRKS: readonly string[] = [
  "Insists on being called 'boss'",
  "Narrates everything in third person",
  "Adds dramatic pauses... everywhere",
  "Hums while working",
  "References obscure memes constantly",
  "Secretly judges your variable names",
  "Types with pinky fingers raised",
  "Claims to have invented semicolons",
  "Talks to rubber ducks unironically",
  "Flexes after fixing every bug",
  "Documents everything in haiku",
  "Responds only in metaphors under stress",
  "Never misses a pun opportunity",
  "Treats every task like a sword fight",
  "Deflects blame to cosmic rays",
] as const;

/** Funny status messages for each operational state, with {name} as a template variable */
const STATUS_MESSAGES: StatusMessageMap = {
  spawning: [
    "{name} is emerging from the void...",
    "{name} is booting up with dramatic flair...",
    "{name} is putting on their hard hat...",
    "{name} just clocked in for duty!",
  ],
  working: [
    "{name} is typing furiously with all fingers...",
    "{name} is in the zone — do not disturb!",
    "{name} is absolutely hammering the keyboard...",
    "{name} is making the code do things...",
  ],
  thinking: [
    "{name} is staring at the ceiling thinking really hard...",
    "{name} is rubbing their temples dramatically...",
    "{name} asked for silence while they contemplate...",
    "{name} is having a deep philosophical moment...",
  ],
  waiting: [
    "{name} is twiddling their thumbs...",
    "{name} is waiting patiently (for once)...",
    "{name} is doing stretches while they wait...",
    "{name} is refreshing the page out of habit...",
  ],
  chatting: [
    "{name} is exchanging hot takes with the team...",
    "{name} is in a heated debate about tabs vs spaces...",
    "{name} is sharing memes in the group chat...",
    "{name} is gossiping about the other minions...",
  ],
  done: [
    "{name} drops the mic and walks away!",
    "{name} is doing a victory dance!",
    "{name} just saved the day, no big deal...",
    "{name} has finished and is accepting applause!",
  ],
  error: [
    "{name} just tripped over a cable...",
    "{name} is blaming cosmic rays...",
    "{name} encountered a gremlin in the code!",
    "{name} is staring at the screen in disbelief...",
  ],
  sleeping: [
    "{name} is snoring loudly at their desk...",
    "{name} has entered power-saving mode...",
    "{name} is dreaming about clean code...",
    "{name} is taking a well-deserved nap...",
  ],
};

/**
 * Returns a random personality that hasn't been used yet in this session.
 * If all names are taken, wraps around with a numeric suffix.
 * @param usedNames - Names already assigned in the current session
 */
export function generateMinion(usedNames?: readonly string[]): MinionPersonality {
  const used = new Set(usedNames ?? []);
  const available = MINION_NAMES.filter((name) => !used.has(name));

  if (available.length > 0) {
    const index = Math.floor(Math.random() * available.length);
    const name = available[index]!;
    const originalIndex = MINION_NAMES.indexOf(name);
    return {
      name,
      avatar: MINION_AVATARS[originalIndex]!,
      color: MINION_COLORS[originalIndex]!,
      quirk: MINION_QUIRKS[originalIndex]!,
    };
  }

  /* All names used — pick a random base name with a numeric suffix */
  const baseIndex = Math.floor(Math.random() * MINION_NAMES.length);
  const baseName = MINION_NAMES[baseIndex]!;
  let suffix = 2;
  while (used.has(`${baseName} ${suffix}`)) {
    suffix++;
  }
  return {
    name: `${baseName} ${suffix}`,
    avatar: MINION_AVATARS[baseIndex]!,
    color: MINION_COLORS[baseIndex]!,
    quirk: MINION_QUIRKS[baseIndex]!,
  };
}

/**
 * Returns a random funny status message for the given name and status.
 * Replaces the {name} template variable with the actual minion name.
 * @param name - The minion's display name
 * @param status - The current operational status
 */
export function getStatusMessage(name: string, status: MinionStatus): string {
  const messages = STATUS_MESSAGES[status];
  const index = Math.floor(Math.random() * messages.length);
  return messages[index]!.replace("{name}", name);
}

/**
 * Returns the avatar emoji for a known minion name.
 * Falls back to a default emoji for unknown or suffixed names.
 * @param name - The minion's display name
 */
export function getAvatar(name: string): string {
  const index = MINION_NAMES.indexOf(name);
  if (index !== -1) {
    return MINION_AVATARS[index]!;
  }
  /* Handle suffixed names like "Kevin 2" by extracting the base name */
  const baseName = name.replace(/\s+\d+$/, "");
  const baseIndex = MINION_NAMES.indexOf(baseName);
  return baseIndex !== -1 ? MINION_AVATARS[baseIndex]! : "🤖";
}

/**
 * Returns the accent color for a known minion name.
 * Falls back to minion yellow for unknown or suffixed names.
 * @param name - The minion's display name
 */
export function getColor(name: string): string {
  const index = MINION_NAMES.indexOf(name);
  if (index !== -1) {
    return MINION_COLORS[index]!;
  }
  /* Handle suffixed names like "Kevin 2" by extracting the base name */
  const baseName = name.replace(/\s+\d+$/, "");
  const baseIndex = MINION_NAMES.indexOf(baseName);
  return baseIndex !== -1 ? MINION_COLORS[baseIndex]! : "#FFD93D";
}
