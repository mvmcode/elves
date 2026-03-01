/* Elf character sprite with state machine, animation, and canvas rendering — the heart of the workshop scene. */

import type {
  BubbleType,
  CarryItemType,
  Direction,
  ElfSpriteConfig,
  ElfSpriteState,
  QueuedAction,
  SpeechBubbleConfig,
  Vec2,
  WorkAnimation,
} from "../../types/workshop";
import { SCALE } from "./workshop-layout";

/** Pixel-aligned rectangle draw helper — all coordinates are floored for crisp pixel art. */
function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

/** Walking speed in pixels per normalized frame (~16ms). */
const WALK_SPEED = 1.2;

/** Distance threshold (px) for considering a path waypoint as reached. */
const WAYPOINT_THRESHOLD = 2;

/** How long a speech bubble stays visible by default (in normalized frames). */
const DEFAULT_BUBBLE_DURATION = 150;

/** Blink occurs every N frames — eyes close for 1 frame out of this cycle. */
const BLINK_CYCLE = 40;

/** Boot color for all elves. */
const BOOT_COLOR = "#5A3A2A";

/** Apron color (info blue from design system). */
const APRON_COLOR = "#4D96FF";

/**
 * Elf character in the workshop scene.
 *
 * Manages its own state machine, animation timers, pathfinding walk,
 * speech bubbles, and action queue. The `update()` method advances simulation
 * and `draw()` renders the elf to a canvas context.
 *
 * States:
 * - entering: walking in from the door
 * - idle: standing at a bench, no active work
 * - walking: following a path between waypoints
 * - working: seated at a bench, active tool animation (type/read/hammer/mix)
 * - carrying: walking with an item held overhead
 * - delivering: dropping off an item at a bench
 * - waiting: idle with a "waiting for permission" pose
 * - celebrating: jumping with sparkle particles
 * - sleeping: at a cot, ZZZ particles
 * - error: shaking in place, error bubble
 * - permission: arms raised, waiting for user input
 * - arguing: two elves in disagreement animation
 * - exiting: walking toward the door to leave
 */
export class ElfSprite {
  readonly id: string;
  readonly name: string;
  readonly hatColor: string;
  readonly bodyColor: string;
  readonly accessory: string;

  position: Vec2;
  facing: Direction;
  state: ElfSpriteState;

  private path: Vec2[] = [];
  private workAnimation: WorkAnimation;
  workbenchId: number | null;
  private carryItem: CarryItemType | null;
  private speechBubble: SpeechBubbleConfig | null = null;
  private actionQueue: QueuedAction[] = [];
  private animTimer: number = 0;

  /** Shake offset for error state. */
  private shakeOffset: number = 0;

  constructor(config: ElfSpriteConfig) {
    this.id = config.id;
    this.name = config.name;
    this.hatColor = config.hatColor;
    this.bodyColor = config.bodyColor;
    this.accessory = config.accessory;
    this.position = { ...config.position };
    this.facing = config.facing;
    this.state = config.state;
    this.workAnimation = config.workAnimation;
    this.workbenchId = config.workbenchId;
    this.carryItem = config.carryItem;
    this.path = [...config.path];
    this.animTimer = config.animTimer;

    if (config.speechBubble) {
      this.speechBubble = { ...config.speechBubble };
    }
    this.actionQueue = config.actionQueue.map((action) => ({ ...action }));
  }

  /** Transition to a new state. Clears state-specific timers. */
  transition(newState: ElfSpriteState, params?: Record<string, unknown>): void {
    this.state = newState;
    this.animTimer = 0;
    this.shakeOffset = 0;

    if (params?.carryItem !== undefined) {
      this.carryItem = params.carryItem as CarryItemType | null;
    }
    if (params?.workAnimation !== undefined) {
      this.workAnimation = params.workAnimation as WorkAnimation;
    }
    if (params?.workbenchId !== undefined) {
      this.workbenchId = params.workbenchId as number | null;
    }
    if (params?.facing !== undefined) {
      this.facing = params.facing as Direction;
    }
  }

  /**
   * Per-frame update. Advances animation timers, processes walking,
   * handles speech bubble decay, and pops queued actions.
   *
   * @param dt - Time delta in milliseconds since last frame
   * @param time - Absolute time in milliseconds (for sin-wave animations)
   */
  update(dt: number, time: number): void {
    const frameDt = Math.min(dt, 32) / 16;
    this.animTimer += frameDt;

    this.updateSpeechBubble(frameDt);
    this.updateStateLogic(frameDt, time);
    this.processActionQueue(frameDt);
  }

  /**
   * Render the elf to a canvas context.
   *
   * Draw order: shadow -> boots -> body -> apron -> arms -> head -> ears ->
   * eyes -> mouth -> hat -> name tag -> speech bubble.
   *
   * @param ctx - Canvas 2D rendering context
   * @param time - Absolute time in ms for animation calculations
   */
  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const x = Math.floor(this.position.x) + this.shakeOffset;
    const y = Math.floor(this.position.y);
    const bounce = this.calculateBounce(time);
    const by = y - bounce;

    this.drawShadow(ctx, x, y);
    this.drawBoots(ctx, x, by);
    this.drawBody(ctx, x, by);
    this.drawApron(ctx, x, by);
    this.drawArms(ctx, x, by, time);
    this.drawHead(ctx, x, by);
    this.drawEars(ctx, x, by);
    this.drawEyes(ctx, x, by, time);
    this.drawMouth(ctx, x, by);
    this.drawHat(ctx, x, by);
    this.drawNameTag(ctx, x, by);

    if (this.speechBubble) {
      this.drawSpeechBubble(ctx, x, by - SCALE * 24);
    }
  }

  /** Queue an action to perform after the current state completes. */
  queueAction(action: QueuedAction): void {
    this.actionQueue.push({ ...action });
  }

  /** Set a walking path (array of pixel-space waypoints). */
  setPath(pathPoints: Vec2[]): void {
    this.path = pathPoints.map((point) => ({ ...point }));
  }

  /** Display a speech bubble above the elf. Duration in normalized frames. */
  setSpeechBubble(
    text: string,
    type: BubbleType,
    icon?: string,
    duration?: number,
  ): void {
    const maxTimer = duration ?? DEFAULT_BUBBLE_DURATION;
    this.speechBubble = { text, type, icon, timer: 0, maxTimer };
  }

  /** Clear the current speech bubble immediately. */
  clearSpeechBubble(): void {
    this.speechBubble = null;
  }

  /** Get current position (read-only copy). */
  getPosition(): Vec2 {
    return { x: this.position.x, y: this.position.y };
  }

  /** Get elf unique identifier. */
  getId(): string {
    return this.id;
  }

  /** Get current state. */
  getState(): ElfSpriteState {
    return this.state;
  }

  /** Get the assigned workbench id, or null if none. */
  getWorkbenchId(): number | null {
    return this.workbenchId;
  }

  /** Assign this elf to a workbench by id. */
  assignWorkbench(benchId: number): void {
    this.workbenchId = benchId;
  }

  /** Get the current work animation type. */
  getWorkAnimation(): WorkAnimation {
    return this.workAnimation;
  }

  /** Get the current facing direction. */
  getFacing(): Direction {
    return this.facing;
  }

  /** Convenience alias for transition() used by EventProcessor. */
  transitionTo(newState: ElfSpriteState, workAnim?: WorkAnimation): void {
    this.transition(newState, workAnim ? { workAnimation: workAnim } : undefined);
  }

  /** Show a speech bubble. Duration in seconds (converted to frames internally). */
  showBubble(text: string, type: BubbleType, durationSeconds: number): void {
    this.setSpeechBubble(text, type, undefined, durationSeconds * 60);
  }

  /** Set target position and start walking. */
  walkTo(targetX: number, targetY: number): void {
    this.setPath([{ x: targetX, y: targetY }]);
    if (this.state !== "carrying") {
      this.transition("walking");
    }
  }

  /** Check if the elf is currently carrying an item. */
  isCarrying(): boolean {
    return this.carryItem !== null;
  }

  /** Get carried item type, or null. */
  getCarryItem(): CarryItemType | null {
    return this.carryItem;
  }

  // ---- State-specific update logic ----

  private updateStateLogic(frameDt: number, _time: number): void {
    switch (this.state) {
      case "walking":
      case "carrying":
      case "entering":
      case "exiting":
        this.updateWalking(frameDt);
        break;
      case "error":
        this.updateError(frameDt);
        break;
      case "celebrating":
        // Celebration is driven by animTimer, no special logic needed
        break;
      default:
        break;
    }
  }

  private updateWalking(frameDt: number): void {
    if (this.path.length === 0) {
      // Path complete — transition based on current state
      if (this.state === "entering") {
        this.transition("idle");
      } else if (this.state === "exiting") {
        // Elf has exited — could emit an event here
        this.transition("idle");
      } else if (this.state === "carrying") {
        this.transition("delivering", { carryItem: this.carryItem });
      } else {
        this.transition("idle");
      }
      return;
    }

    const target = this.path[0]!;
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= WAYPOINT_THRESHOLD) {
      this.position = { x: target.x, y: target.y };
      this.path.shift();
      return;
    }

    const step = WALK_SPEED * frameDt;
    this.position = {
      x: this.position.x + (dx / dist) * step,
      y: this.position.y + (dy / dist) * step,
    };

    // Update facing direction based on dominant movement axis
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? "right" : "left";
    } else {
      this.facing = dy > 0 ? "down" : "up";
    }
  }

  private updateError(_frameDt: number): void {
    // Shake horizontally with decaying amplitude
    this.shakeOffset = Math.sin(this.animTimer * 2) * SCALE * Math.max(0, 1 - this.animTimer / 30);
    if (this.animTimer > 30) {
      this.shakeOffset = 0;
    }
  }

  private updateSpeechBubble(frameDt: number): void {
    if (!this.speechBubble) return;

    this.speechBubble = {
      ...this.speechBubble,
      timer: this.speechBubble.timer + frameDt,
    };

    if (this.speechBubble.timer >= this.speechBubble.maxTimer) {
      this.speechBubble = null;
    }
  }

  private processActionQueue(frameDt: number): void {
    if (this.actionQueue.length === 0) return;

    const isIdleState =
      this.state === "idle" ||
      this.state === "delivering";

    if (!isIdleState) return;

    const nextAction = this.actionQueue[0]!;
    if (nextAction.delay > 0) {
      this.actionQueue[0] = {
        action: nextAction.action,
        params: nextAction.params,
        delay: nextAction.delay - frameDt,
      };
      return;
    }

    this.actionQueue.shift();

    switch (nextAction.action) {
      case "walkTo": {
        const targetPath = nextAction.params["path"] as Vec2[] | undefined;
        if (targetPath) {
          this.setPath(targetPath);
          this.transition("walking");
        }
        break;
      }
      case "deliver": {
        const deliverPath = nextAction.params["path"] as Vec2[] | undefined;
        const item = nextAction.params["item"] as CarryItemType | undefined;
        if (deliverPath) {
          this.setPath(deliverPath);
          this.transition("carrying", { carryItem: item ?? "package" });
        }
        break;
      }
      case "transition": {
        const targetState = nextAction.params["state"] as ElfSpriteState;
        this.transition(targetState, nextAction.params);
        break;
      }
    }
  }

  // ---- Animation helpers ----

  private calculateBounce(time: number): number {
    switch (this.state) {
      case "working":
        return Math.sin(time * 0.008) * SCALE;
      case "walking":
      case "carrying":
      case "entering":
      case "exiting":
        return Math.abs(Math.sin(time * 0.012)) * SCALE * 1.5;
      case "celebrating":
        return Math.abs(Math.sin(time * 0.015)) * SCALE * 3;
      case "sleeping":
        return 0;
      default:
        return 0;
    }
  }

  // ---- Drawing methods — ported from mockup drawElf() ----

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + SCALE * 8, SCALE * 4, SCALE * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBoots(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    // Left boot
    drawPixelRect(ctx, x - SCALE * 3, by + SCALE * 4, SCALE * 3, SCALE * 4, BOOT_COLOR);
    // Right boot
    drawPixelRect(ctx, x + SCALE, by + SCALE * 4, SCALE * 3, SCALE * 4, BOOT_COLOR);
    // Curled toes
    drawPixelRect(ctx, x - SCALE * 4, by + SCALE * 6, SCALE * 2, SCALE * 2, BOOT_COLOR);
    drawPixelRect(ctx, x + SCALE * 3, by + SCALE * 6, SCALE * 2, SCALE * 2, BOOT_COLOR);
  }

  private drawBody(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    drawPixelRect(ctx, x - SCALE * 4, by - SCALE * 4, SCALE * 8, SCALE * 10, this.bodyColor);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = SCALE * 0.8;
    ctx.strokeRect(x - SCALE * 4, by - SCALE * 4, SCALE * 8, SCALE * 10);
  }

  private drawApron(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    drawPixelRect(ctx, x - SCALE * 3, by, SCALE * 6, SCALE * 6, APRON_COLOR);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = SCALE * 0.5;
    ctx.strokeRect(x - SCALE * 3, by, SCALE * 6, SCALE * 6);
  }

  private drawArms(
    ctx: CanvasRenderingContext2D,
    x: number,
    by: number,
    time: number,
  ): void {
    if (this.state === "working" && this.workAnimation === "type") {
      // Typing animation — arms forward with alternating wave
      const armWave = Math.sin(time * 0.015) * SCALE;
      drawPixelRect(ctx, x - SCALE * 6, by - SCALE + armWave, SCALE * 3, SCALE * 3, this.bodyColor);
      drawPixelRect(ctx, x + SCALE * 4, by - SCALE - armWave, SCALE * 3, SCALE * 3, this.bodyColor);
    } else if (this.state === "working" && this.workAnimation === "read") {
      // Reading — arms at sides, slight inward angle
      drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 2, SCALE * 3, SCALE * 5, this.bodyColor);
      drawPixelRect(ctx, x + SCALE * 4, by - SCALE * 2, SCALE * 3, SCALE * 5, this.bodyColor);
    } else if (this.carryItem !== null) {
      // Carrying — arms overhead holding item
      drawPixelRect(ctx, x - SCALE * 2, by - SCALE * 10, SCALE * 4, SCALE * 3, this.bodyColor);
      // Carried item box
      drawPixelRect(ctx, x - SCALE * 3, by - SCALE * 13, SCALE * 6, SCALE * 4, APRON_COLOR);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = SCALE * 0.5;
      ctx.strokeRect(x - SCALE * 3, by - SCALE * 13, SCALE * 6, SCALE * 4);
    } else if (this.state === "permission" || this.state === "waiting") {
      // Arms raised — requesting permission
      drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 8, SCALE * 3, SCALE * 5, this.bodyColor);
      drawPixelRect(ctx, x + SCALE * 4, by - SCALE * 8, SCALE * 3, SCALE * 5, this.bodyColor);
    } else if (this.state === "celebrating") {
      // Arms up in celebration
      const wave = Math.sin(time * 0.02) * SCALE;
      drawPixelRect(ctx, x - SCALE * 7, by - SCALE * 7 + wave, SCALE * 3, SCALE * 4, this.bodyColor);
      drawPixelRect(ctx, x + SCALE * 5, by - SCALE * 7 - wave, SCALE * 3, SCALE * 4, this.bodyColor);
    } else {
      // Default — arms at sides
      drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 2, SCALE * 3, SCALE * 5, this.bodyColor);
      drawPixelRect(ctx, x + SCALE * 4, by - SCALE * 2, SCALE * 3, SCALE * 5, this.bodyColor);
    }
  }

  private drawHead(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    drawPixelRect(ctx, x - SCALE * 5, by - SCALE * 12, SCALE * 10, SCALE * 9, this.bodyColor);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = SCALE * 0.8;
    ctx.strokeRect(x - SCALE * 5, by - SCALE * 12, SCALE * 10, SCALE * 9);
  }

  private drawEars(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    ctx.fillStyle = this.bodyColor;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = SCALE * 0.8;

    // Left ear (pointy triangle)
    ctx.beginPath();
    ctx.moveTo(x - SCALE * 5, by - SCALE * 8);
    ctx.lineTo(x - SCALE * 9, by - SCALE * 12);
    ctx.lineTo(x - SCALE * 4, by - SCALE * 6);
    ctx.fill();
    ctx.stroke();

    // Right ear
    ctx.beginPath();
    ctx.moveTo(x + SCALE * 5, by - SCALE * 8);
    ctx.lineTo(x + SCALE * 9, by - SCALE * 12);
    ctx.lineTo(x + SCALE * 4, by - SCALE * 6);
    ctx.fill();
    ctx.stroke();
  }

  private drawEyes(
    ctx: CanvasRenderingContext2D,
    x: number,
    by: number,
    time: number,
  ): void {
    const blinkPhase = Math.floor(time * 0.004) % BLINK_CYCLE;

    if (blinkPhase === 0) {
      // Blink — eyes are thin horizontal lines
      drawPixelRect(ctx, x - SCALE * 3, by - SCALE * 8, SCALE * 2, SCALE, "#000");
      drawPixelRect(ctx, x + SCALE * 1, by - SCALE * 8, SCALE * 2, SCALE, "#000");
    } else {
      // Open eyes — white squares with black pupils
      drawPixelRect(ctx, x - SCALE * 3, by - SCALE * 9, SCALE * 2, SCALE * 2, "#FFF");
      drawPixelRect(ctx, x + SCALE * 1, by - SCALE * 9, SCALE * 2, SCALE * 2, "#FFF");

      // Pupils — look direction based on work animation
      const lookX = this.workAnimation === "read" ? -SCALE : 0;
      drawPixelRect(ctx, x - SCALE * 3 + SCALE + lookX, by - SCALE * 9, SCALE, SCALE * 2, "#000");
      drawPixelRect(ctx, x + SCALE * 1 + SCALE + lookX, by - SCALE * 9, SCALE, SCALE * 2, "#000");
    }
  }

  private drawMouth(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    drawPixelRect(ctx, x - SCALE, by - SCALE * 6, SCALE * 2, SCALE, "#000");
  }

  private drawHat(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    // Pointy hat triangle
    ctx.fillStyle = this.hatColor;
    ctx.beginPath();
    ctx.moveTo(x - SCALE * 5, by - SCALE * 12);
    ctx.lineTo(x, by - SCALE * 20);
    ctx.lineTo(x + SCALE * 5, by - SCALE * 12);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = SCALE * 0.8;
    ctx.stroke();

    // Hat brim
    drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 13, SCALE * 12, SCALE * 2, this.hatColor);
    ctx.strokeRect(x - SCALE * 6, by - SCALE * 13, SCALE * 12, SCALE * 2);

    // White pom pom at tip
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(x, by - SCALE * 20, SCALE * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawNameTag(ctx: CanvasRenderingContext2D, x: number, by: number): void {
    ctx.font = `${SCALE * 3}px 'Press Start 2P', monospace`;
    const nameWidth = ctx.measureText(this.name).width;

    // Background pill
    drawPixelRect(
      ctx,
      x - nameWidth / 2 - SCALE * 2,
      by + SCALE * 12,
      nameWidth + SCALE * 4,
      SCALE * 5,
      "rgba(0,0,0,0.7)",
    );

    // Name text
    ctx.fillStyle = "#FFF";
    ctx.textAlign = "center";
    ctx.fillText(this.name, x, by + SCALE * 16);
  }

  private drawSpeechBubble(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.speechBubble) return;

    const displayText = this.speechBubble.icon
      ? `${this.speechBubble.icon} ${this.speechBubble.text}`
      : this.speechBubble.text;

    ctx.font = `${SCALE * 3}px 'Press Start 2P', monospace`;
    const textWidth = ctx.measureText(displayText).width + SCALE * 8;
    const bubbleHeight = SCALE * 8;
    const bubbleX = x - textWidth / 2;
    const bubbleY = y - bubbleHeight;

    // Bubble background
    ctx.fillStyle = "#FFF";
    ctx.fillRect(bubbleX, bubbleY, textWidth, bubbleHeight);

    // Bubble border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = SCALE * 0.8;
    ctx.strokeRect(bubbleX, bubbleY, textWidth, bubbleHeight);

    // Tail triangle pointing down to elf
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.moveTo(x - SCALE * 2, bubbleY + bubbleHeight);
    ctx.lineTo(x, bubbleY + bubbleHeight + SCALE * 3);
    ctx.lineTo(x + SCALE * 2, bubbleY + bubbleHeight);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText(displayText, x, bubbleY + SCALE * 5.5);
  }
}
