/* ElfAvatar — neo-brutalist SVG elf avatar with status-driven CSS animations. */

import type { ElfStatus } from "@/types/elf";

/** Avatar IDs matching the 15 elf names in order. */
export type AvatarId =
  | "spark"
  | "tinker"
  | "jingle"
  | "sprocket"
  | "nimble"
  | "flicker"
  | "bramble"
  | "thistle"
  | "cobalt"
  | "pip"
  | "fern"
  | "maple"
  | "cricket"
  | "rune"
  | "ember";

/** Display sizes for the elf avatar. */
export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface ElfAvatarProps {
  readonly avatarId: AvatarId;
  readonly status: ElfStatus;
  readonly size?: AvatarSize;
  readonly color?: string;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 80,
  xl: 120,
};

/** Maps elf status to a CSS animation class name. */
const STATUS_ANIMATION: Record<ElfStatus, string> = {
  spawning: "elf-anim-idle",
  working: "elf-anim-working",
  thinking: "elf-anim-thinking",
  waiting: "elf-anim-idle",
  chatting: "elf-anim-idle",
  done: "elf-anim-done",
  error: "elf-anim-error",
  sleeping: "elf-anim-sleeping",
};

/**
 * Renders the unique accessory for each avatar on top of the base elf shape.
 * Each accessory is a simple geometric SVG element with thick black outlines.
 */
function renderAccessory(avatarId: AvatarId): React.JSX.Element {
  switch (avatarId) {
    /* Spark — lightning bolt */
    case "spark":
      return (
        <polygon
          points="22,4 18,14 23,14 17,26 21,16 16,16"
          fill="#FFD93D"
          stroke="#000"
          strokeWidth="1.5"
        />
      );
    /* Tinker — wrench */
    case "tinker":
      return (
        <g>
          <rect x="20" y="3" width="3" height="10" rx="1" fill="#AAA" stroke="#000" strokeWidth="1.5" />
          <circle cx="21.5" cy="4" r="3" fill="none" stroke="#000" strokeWidth="1.5" />
        </g>
      );
    /* Jingle — bell */
    case "jingle":
      return (
        <g>
          <path d="M16,6 Q20,2 24,6 L24,10 Q20,13 16,10 Z" fill="#FFD93D" stroke="#000" strokeWidth="1.5" />
          <circle cx="20" cy="12" r="1.5" fill="#000" />
        </g>
      );
    /* Sprocket — gear */
    case "sprocket":
      return (
        <g>
          <circle cx="20" cy="7" r="5" fill="#4D96FF" stroke="#000" strokeWidth="1.5" />
          <circle cx="20" cy="7" r="2" fill="#FFF" stroke="#000" strokeWidth="1" />
          {/* Gear teeth */}
          <rect x="19" y="1" width="2" height="3" fill="#4D96FF" stroke="#000" strokeWidth="0.8" />
          <rect x="19" y="10" width="2" height="3" fill="#4D96FF" stroke="#000" strokeWidth="0.8" />
          <rect x="14" y="6" width="3" height="2" fill="#4D96FF" stroke="#000" strokeWidth="0.8" />
          <rect x="23" y="6" width="3" height="2" fill="#4D96FF" stroke="#000" strokeWidth="0.8" />
        </g>
      );
    /* Nimble — headband */
    case "nimble":
      return (
        <g>
          <rect x="10" y="10" width="20" height="3" rx="1" fill="#FF6B6B" stroke="#000" strokeWidth="1.5" />
          <polygon points="28,8 32,11 28,14" fill="#FF6B6B" stroke="#000" strokeWidth="1" />
        </g>
      );
    /* Flicker — candle */
    case "flicker":
      return (
        <g>
          <rect x="19" y="6" width="3" height="8" fill="#FFFDE7" stroke="#000" strokeWidth="1.5" />
          <ellipse cx="20.5" cy="5" rx="2.5" ry="3" fill="#FF8B3D" stroke="#000" strokeWidth="1" />
          <ellipse cx="20.5" cy="4.5" rx="1" ry="1.5" fill="#FFD93D" />
        </g>
      );
    /* Bramble — bandana */
    case "bramble":
      return (
        <g>
          <path d="M10,10 Q20,7 30,10 L28,13 Q20,10 12,13 Z" fill="#6BCB77" stroke="#000" strokeWidth="1.5" />
          <circle cx="26" cy="12" r="1" fill="#000" />
        </g>
      );
    /* Thistle — flower */
    case "thistle":
      return (
        <g>
          <circle cx="25" cy="6" r="2" fill="#E879F9" stroke="#000" strokeWidth="1" />
          <circle cx="22" cy="4" r="2" fill="#E879F9" stroke="#000" strokeWidth="1" />
          <circle cx="22" cy="8" r="2" fill="#E879F9" stroke="#000" strokeWidth="1" />
          <circle cx="23" cy="6" r="1.5" fill="#FFD93D" />
          <line x1="23" y1="8" x2="23" y2="14" stroke="#6BCB77" strokeWidth="1.5" />
        </g>
      );
    /* Cobalt — monocle */
    case "cobalt":
      return (
        <g>
          <circle cx="24" cy="18" r="4" fill="none" stroke="#000" strokeWidth="2" />
          <circle cx="24" cy="18" r="3" fill="rgba(77,150,255,0.2)" stroke="none" />
          <line x1="28" y1="18" x2="32" y2="22" stroke="#000" strokeWidth="1.5" />
        </g>
      );
    /* Pip — bow tie */
    case "pip":
      return (
        <g>
          <polygon points="16,26 20,28 16,30" fill="#FF6B6B" stroke="#000" strokeWidth="1" />
          <polygon points="24,26 20,28 24,30" fill="#FF6B6B" stroke="#000" strokeWidth="1" />
          <circle cx="20" cy="28" r="1.5" fill="#FFD93D" stroke="#000" strokeWidth="1" />
        </g>
      );
    /* Fern — leaf crown */
    case "fern":
      return (
        <g>
          <ellipse cx="15" cy="9" rx="3" ry="5" fill="#6BCB77" stroke="#000" strokeWidth="1" transform="rotate(-20,15,9)" />
          <ellipse cx="20" cy="7" rx="3" ry="5" fill="#34D399" stroke="#000" strokeWidth="1" />
          <ellipse cx="25" cy="9" rx="3" ry="5" fill="#6BCB77" stroke="#000" strokeWidth="1" transform="rotate(20,25,9)" />
        </g>
      );
    /* Maple — chef hat */
    case "maple":
      return (
        <g>
          <rect x="13" y="7" width="14" height="5" fill="#FFF" stroke="#000" strokeWidth="1.5" />
          <ellipse cx="20" cy="6" rx="8" ry="5" fill="#FFF" stroke="#000" strokeWidth="1.5" />
        </g>
      );
    /* Cricket — headphones */
    case "cricket":
      return (
        <g>
          <path d="M11,16 Q11,8 20,8 Q29,8 29,16" fill="none" stroke="#000" strokeWidth="2.5" />
          <rect x="8" y="14" width="5" height="7" rx="2" fill="#4D96FF" stroke="#000" strokeWidth="1.5" />
          <rect x="27" y="14" width="5" height="7" rx="2" fill="#4D96FF" stroke="#000" strokeWidth="1.5" />
        </g>
      );
    /* Rune — wizard hat */
    case "rune":
      return (
        <g>
          <polygon points="20,1 10,14 30,14" fill="#A78BFA" stroke="#000" strokeWidth="1.5" />
          <rect x="9" y="13" width="22" height="3" fill="#A78BFA" stroke="#000" strokeWidth="1" />
          <polygon points="19,5 21,5 22,8 18,8" fill="#FFD93D" stroke="#000" strokeWidth="0.8" />
        </g>
      );
    /* Ember — crown */
    case "ember":
      return (
        <g>
          <polygon points="12,12 14,5 17,10 20,3 23,10 26,5 28,12" fill="#FFD93D" stroke="#000" strokeWidth="1.5" />
          <rect x="12" y="11" width="16" height="3" fill="#FFD93D" stroke="#000" strokeWidth="1" />
        </g>
      );
  }
}

/**
 * Neo-brutalist elf avatar with inline SVG and CSS animation driven by ElfStatus.
 * Each of the 15 elf names maps to a unique accessory drawn on a shared base shape.
 * Animations: idle=gentle bounce, working=fast bounce+wobble, thinking=tilt,
 * done=jump+sparkle, error=shake, sleeping=sway.
 */
export function ElfAvatar({
  avatarId,
  status,
  size = "md",
  color = "#FFD93D",
}: ElfAvatarProps): React.JSX.Element {
  const pixelSize = SIZE_MAP[size];
  const animationClass = STATUS_ANIMATION[status];

  return (
    <div
      className={animationClass}
      style={{ width: pixelSize, height: pixelSize, display: "inline-flex" }}
      data-testid="elf-avatar"
      data-avatar-id={avatarId}
      data-status={status}
    >
      <svg
        viewBox="0 0 40 40"
        width={pixelSize}
        height={pixelSize}
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`Elf avatar: ${avatarId}`}
      >
        {/* Base elf body — rounded head + triangle body */}
        <circle cx="20" cy="17" r="8" fill={color} stroke="#000" strokeWidth="2" />
        {/* Pointy ears */}
        <polygon points="10,15 6,10 13,14" fill={color} stroke="#000" strokeWidth="1.5" />
        <polygon points="30,15 34,10 27,14" fill={color} stroke="#000" strokeWidth="1.5" />
        {/* Eyes */}
        <circle cx="17" cy="17" r="1.5" fill="#000" />
        <circle cx="23" cy="17" r="1.5" fill="#000" />
        {/* Smile */}
        <path d="M17,20 Q20,23 23,20" fill="none" stroke="#000" strokeWidth="1.2" strokeLinecap="round" />
        {/* Body */}
        <polygon points="14,24 20,36 26,24" fill={color} stroke="#000" strokeWidth="2" />
        {/* Accessory overlay */}
        {renderAccessory(avatarId)}
      </svg>
    </div>
  );
}

/** Map from elf name to avatar ID, matching the order in elf-names.ts. */
export const ELF_NAME_TO_AVATAR: Record<string, AvatarId> = {
  Spark: "spark",
  Tinker: "tinker",
  Jingle: "jingle",
  Sprocket: "sprocket",
  Nimble: "nimble",
  Flicker: "flicker",
  Bramble: "bramble",
  Thistle: "thistle",
  Cobalt: "cobalt",
  Pip: "pip",
  Fern: "fern",
  Maple: "maple",
  Cricket: "cricket",
  Rune: "rune",
  Ember: "ember",
};

/** All avatar IDs for iteration and testing. */
export const ALL_AVATAR_IDS: readonly AvatarId[] = [
  "spark", "tinker", "jingle", "sprocket", "nimble",
  "flicker", "bramble", "thistle", "cobalt", "pip",
  "fern", "maple", "cricket", "rune", "ember",
] as const;

/**
 * Resolves an elf name (including suffixed names like "Spark 2") to an AvatarId.
 * Falls back to "spark" for unknown names.
 */
export function getAvatarId(elfName: string): AvatarId {
  const direct = ELF_NAME_TO_AVATAR[elfName];
  if (direct) return direct;

  /* Handle suffixed names like "Spark 2" */
  const baseName = elfName.replace(/\s+\d+$/, "");
  return ELF_NAME_TO_AVATAR[baseName] ?? "spark";
}
