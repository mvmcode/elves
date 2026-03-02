/* Workshop scene types — defines the pixel-art workshop visualization system. */

/** 2D vector for positions and velocities */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Tile grid coordinates (integer-based) */
export interface TilePos {
  readonly col: number;
  readonly row: number;
}

/** Cardinal directions for elf facing */
export type Direction = "up" | "down" | "left" | "right";

/** Work animation types mapped from tool usage */
export type WorkAnimation = "type" | "read" | "hammer" | "mix";

/** Items an elf can carry between workbenches */
export type CarryItemType = "scroll" | "gear" | "package" | "potion" | "cookie";

/** Elf character states in the workshop scene state machine */
export type ElfSpriteState =
  | "entering"
  | "idle"
  | "walking"
  | "working"
  | "carrying"
  | "delivering"
  | "waiting"
  | "celebrating"
  | "sleeping"
  | "error"
  | "permission"
  | "arguing"
  | "exiting"
  | "wandering";

/** Speech bubble variants displayed above elf heads */
export type BubbleType = "thought" | "speech" | "alert";

/** Speech bubble configuration */
export interface SpeechBubbleConfig {
  readonly text: string;
  readonly icon?: string;
  readonly type: BubbleType;
  readonly timer: number;
  readonly maxTimer: number;
}

/** Queued action for elf to perform after current state completes */
export interface QueuedAction {
  readonly action: "walkTo" | "deliver" | "transition";
  readonly params: Record<string, unknown>;
  readonly delay: number;
}

/** Configuration for a single elf sprite in the workshop */
export interface ElfSpriteConfig {
  readonly id: string;
  readonly name: string;
  position: Vec2;
  targetPosition: Vec2 | null;
  path: Vec2[];
  state: ElfSpriteState;
  facing: Direction;
  animFrame: number;
  animTimer: number;
  workbenchId: number | null;
  workAnimation: WorkAnimation;
  carryItem: CarryItemType | null;
  speechBubble: SpeechBubbleConfig | null;
  actionQueue: QueuedAction[];
  readonly hatColor: string;
  readonly accessory: string;
  readonly bodyColor: string;
  /** Palette index for color diversity (0-5). */
  readonly paletteIndex: number;
  /** Whether this elf is actively working (drives wander vs work behavior). */
  isActive: boolean;
}

/** Workbench theme indices matching the design spec */
export type WorkbenchTheme =
  | 0  // Mechanical
  | 1  // Research
  | 2  // Code
  | 3  // Testing
  | 4  // Architecture
  | 5; // Writing

/** Workbench definition in the workshop layout */
export interface WorkbenchConfig {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly theme: WorkbenchTheme;
  assignedElfId: string | null;
}

/** Item riding the conveyor belt */
export interface ConveyorItemConfig {
  x: number;
  readonly color: string;
  readonly label?: string;
}

/** Particle types in the workshop */
export type ParticleType =
  | "snow"
  | "sparkle"
  | "smoke"
  | "zzz"
  | "celebrate";

/** A single particle in the particle system */
export interface ParticleConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  readonly maxLife: number;
  readonly color: string;
  readonly type: ParticleType;
  readonly size: number;
}

/** Camera state for viewport control */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  followTargetId: string | null;
}

/** Camera configuration constants for zoom/pan behavior */
export interface CameraConfig {
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly panSpeed: number;
  readonly zoomStep: number;
  readonly followLerp: number;
}

/** Delivery walk phase for inter-elf message choreography */
export type DeliveryWalkPhase =
  | "pickup"
  | "walking_to_receiver"
  | "showing_message"
  | "receiver_nod"
  | "walking_back";

/** State for an active inter-elf delivery walk sequence */
export interface DeliveryWalkState {
  readonly senderId: string;
  readonly receiverId: string;
  readonly message: string;
  phase: DeliveryWalkPhase;
  phaseTimer: number;
}

/** Ceremony celebration phase for session-complete choreography */
export type CeremonyPhase = "celebrate" | "sparkle_burst" | "walk_to_cots" | "sleep";

/** State for an active session-complete ceremony */
export interface CeremonyState {
  phase: CeremonyPhase;
  phaseTimer: number;
  readonly elfIds: readonly string[];
}

/** Door panel animation state */
export interface DoorState {
  isOpen: boolean;
  /** 0 = fully closed, 1 = fully open */
  animProgress: number;
}

/** Click/hover target types for interaction detection */
export type InteractionTarget =
  | { readonly kind: "elf"; readonly elfId: string }
  | { readonly kind: "workbench"; readonly benchId: number }
  | { readonly kind: "noticeBoard" }
  | { readonly kind: "cookieJar" }
  | { readonly kind: "deliveryChute" }
  | { readonly kind: "cots" }
  | { readonly kind: "fireplace" };

/** View mode toggle between pixel art workshop and card grid */
export type WorkshopViewMode = "workshop" | "cards";

/** Light flicker state for ambient effects */
export interface LightFlickerState {
  readonly color: "normal" | "red" | "green";
  readonly timer: number;
  readonly duration: number;
}

/** Cookie jar progress tracking */
export interface CookieJarState {
  readonly tasksDone: number;
  readonly tasksTotal: number;
}

/** Interaction handler callback signatures */
export interface WorkshopCallbacks {
  readonly onElfClick: (elfId: string) => void;
  readonly onBenchClick: (benchId: number) => void;
  readonly onNoticeClick: () => void;
  readonly onCookieClick: () => void;
  readonly onDeliveryClick: () => void;
  readonly onCotsClick: () => void;
  readonly onFireplaceClick: () => void;
  readonly onViewToggle: () => void;
}

/** Elf personality lookup matching design spec characters */
export interface ElfCharacterDef {
  readonly name: string;
  readonly hatColor: string;
  readonly accessory: string;
  readonly workbenchTheme: string;
}

/** All 15 elf character definitions from the design spec */
export const ELF_CHARACTERS: readonly ElfCharacterDef[] = [
  { name: "Tinker", hatColor: "#D04040", accessory: "wrench", workbenchTheme: "Mechanical" },
  { name: "Jingle", hatColor: "#40A040", accessory: "bell", workbenchTheme: "Research" },
  { name: "Sprocket", hatColor: "#4D96FF", accessory: "goggles", workbenchTheme: "Code" },
  { name: "Nimble", hatColor: "#FF8B3D", accessory: "scarf", workbenchTheme: "Testing" },
  { name: "Flicker", hatColor: "#9B59B6", accessory: "candle", workbenchTheme: "Analysis" },
  { name: "Bramble", hatColor: "#8B6914", accessory: "leaf-crown", workbenchTheme: "Debug" },
  { name: "Thistle", hatColor: "#FF69B4", accessory: "flower", workbenchTheme: "Writing" },
  { name: "Cobalt", hatColor: "#1A1A3E", accessory: "monocle", workbenchTheme: "Architecture" },
  { name: "Pip", hatColor: "#FFD93D", accessory: "backpack", workbenchTheme: "Delivery" },
  { name: "Fern", hatColor: "#008080", accessory: "fern-sprig", workbenchTheme: "Data" },
  { name: "Maple", hatColor: "#D4A056", accessory: "maple-badge", workbenchTheme: "Review" },
  { name: "Cricket", hatColor: "#32CD32", accessory: "musical-note", workbenchTheme: "Monitoring" },
  { name: "Rune", hatColor: "#4B0082", accessory: "glowing-rune", workbenchTheme: "Security" },
  { name: "Ember", hatColor: "#DC143C", accessory: "flame", workbenchTheme: "Performance" },
  { name: "Spark", hatColor: "#FFD700", accessory: "star", workbenchTheme: "Lead" },
] as const;
