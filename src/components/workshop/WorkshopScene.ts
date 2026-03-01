/* WorkshopScene — main orchestrator for the pixel-art workshop visualization.
   Owns all subsystems: tilemap, pathfinder, camera, particles, behaviors,
   ambient effects, event processing, and interaction handling. */

import type { ElfEvent } from '../../types/elf';
import type {
  ConveyorItemConfig,
  DoorState,
  InteractionTarget,
  Vec2,
  WorkshopCallbacks,
} from '../../types/workshop';
import { Tilemap } from './Tilemap';
import { TilemapExtras } from './TilemapExtras';
import { Pathfinder } from './Pathfinder';
import { ParticleSystem } from './ParticleSystem';
import { Camera } from './Camera';
import { AmbientEffects } from './AmbientEffects';
import { BehaviorSequencer } from './BehaviorSequencer';
import { ElfSprite } from './ElfSprite';
import { EventProcessor } from './EventProcessor';
import { InteractionHandler } from './InteractionHandler';
import { computeElfPath, updateDynamicBlocks } from './NavigationBridge';
import { WORKBENCHES, DOOR_POS, ST, WALKABLE_GRID } from './workshop-layout';

/** Speed at which conveyor items travel across the belt in pixels per second */
const CONVEYOR_SPEED = 24;

/** Right boundary where conveyor items are removed */
const CONVEYOR_EXIT_X = 27 * ST;

/** Left boundary where conveyor items enter */
const CONVEYOR_ENTER_X = 1 * ST;

/** Door open/close animation speed in progress units per millisecond */
const DOOR_ANIM_SPEED = 0.002;

/**
 * The main workshop scene orchestrator. Owns and coordinates all subsystems:
 * - Tilemap + TilemapExtras for background/environment rendering
 * - Pathfinder + NavigationBridge for elf navigation
 * - Camera for zoom/pan/follow viewport control
 * - ParticleSystem for sparkles, smoke, snow, zzz effects
 * - AmbientEffects for event-triggered lighting overlays
 * - BehaviorSequencer for multi-step elf choreography
 * - EventProcessor for translating ElfEvents into visual actions
 * - InteractionHandler for mouse/keyboard input
 * - ElfSprite collection for agent avatar management
 * - ConveyorBelt for animated output visualization
 *
 * The scene follows a strict render order to maintain correct depth layering:
 * sky/snow > walls > floor > conveyor > door > delivery chute > clock >
 * furniture > cookie jar > fireplace > decorations >
 * elves (Y-sorted) > particles > ambient overlay
 */
export class WorkshopScene {
  private readonly tilemap: Tilemap;
  private readonly tilemapExtras: TilemapExtras;
  private readonly pathfinder: Pathfinder;
  private readonly particleSystem: ParticleSystem;
  readonly camera: Camera;
  private readonly ambientEffects: AmbientEffects;
  private readonly behaviorSequencer: BehaviorSequencer;
  private readonly eventProcessor: EventProcessor;
  private readonly interactionHandler: InteractionHandler;
  private readonly elves: Map<string, ElfSprite>;
  private readonly conveyorItems: ConveyorItemConfig[];
  private time: number;
  private sessionElapsed: number;
  private doorState: DoorState;
  private tasksDone: number;
  private tasksTotal: number;

  constructor(callbacks: WorkshopCallbacks) {
    this.tilemap = new Tilemap();
    this.tilemapExtras = new TilemapExtras();
    this.pathfinder = new Pathfinder(WALKABLE_GRID);
    this.particleSystem = new ParticleSystem();
    this.camera = new Camera();
    this.ambientEffects = new AmbientEffects();
    this.behaviorSequencer = new BehaviorSequencer();
    this.eventProcessor = new EventProcessor();
    this.interactionHandler = new InteractionHandler(callbacks);
    this.elves = new Map();
    this.conveyorItems = [];
    this.time = 0;
    this.sessionElapsed = 0;
    this.doorState = { isOpen: false, animProgress: 0 };
    this.tasksDone = 0;
    this.tasksTotal = 0;
  }

  /* ---- Core Loop ---- */

  /**
   * Advance all subsystems by the given time delta.
   * Called once per animation frame before render().
   *
   * @param dt - Time elapsed since last frame in milliseconds
   */
  update(dt: number): void {
    this.time += dt;
    this.sessionElapsed += dt / 1000;
    const frameDt = Math.min(dt, 32) / 16;

    /* Update dynamic pathfinder blocks from elf positions */
    updateDynamicBlocks(this.pathfinder, this.getAllElves());

    /* Update elf sprites — animation frames, movement along paths, bubble timers */
    for (const elf of this.elves.values()) {
      elf.update(dt, this.time);
    }

    /* Update behavior sequences — deliveries, ceremonies, idle timers */
    this.behaviorSequencer.update(dt, this);

    /* Update conveyor belt items */
    this.updateConveyor(dt);

    /* Update particle system — snow, sparkles, smoke, zzz */
    this.particleSystem.update(dt, this.time);

    /* Update ambient lighting effects — flicker timers, fireworks */
    this.ambientEffects.update(frameDt);

    /* Update camera follow target if tracking an elf */
    const followId = this.camera.getState().followTargetId;
    if (followId !== null) {
      const followElf = this.elves.get(followId);
      if (followElf) {
        this.camera.followElf(followElf.getPosition());
      }
    }

    /* Update camera interpolation */
    this.camera.update(frameDt);

    /* Update door animation — open when elves are entering/exiting */
    this.updateDoor(dt);
  }

  /**
   * Render the entire workshop scene to the provided canvas context.
   * Draws all layers in strict depth order for correct visual overlap.
   * Wraps drawing in camera transform for zoom/pan support.
   *
   * @param ctx - The 2D rendering context to draw into
   */
  render(ctx: CanvasRenderingContext2D): void {
    this.camera.applyTransform(ctx);

    /* 1. Sky and snow */
    this.tilemap.drawSky(ctx, this.time);

    /* 2. Walls */
    this.tilemap.drawWalls(ctx);

    /* 3. Floor */
    this.tilemap.drawFloor(ctx);

    /* 4. Conveyor belt (with animated stripes and items) */
    this.tilemap.drawConveyorBelt(ctx, this.time, this.conveyorItems);

    /* 4b. Door panels (animated open/close) */
    this.tilemapExtras.drawDoor(ctx, this.doorState);

    /* 4c. Delivery chute on left wall */
    this.tilemapExtras.drawDeliveryChute(ctx, this.time);

    /* 4d. Wall clock */
    this.tilemapExtras.drawClock(ctx, this.sessionElapsed);

    /* 5. Lower furniture — workbenches, cots, notice board */
    for (const bench of WORKBENCHES) {
      this.tilemap.drawWorkbench(ctx, bench.x, bench.y, bench.theme, this.time);
    }
    this.tilemap.drawCots(ctx);
    this.tilemap.drawNoticeBoard(ctx);

    /* 5b. Cookie jar with task-based fill level */
    this.tilemapExtras.drawCookieJarFill(ctx, this.time, this.tasksDone, this.tasksTotal);

    /* 6. Fireplace (renders between furniture and decorations for depth) */
    this.tilemap.drawFireplace(ctx, this.time);

    /* 7. Decorations — wreaths, hanging lights (via TilemapExtras) */
    this.tilemapExtras.drawDecorations(ctx, this.time);

    /* 8. Elves — sorted by Y position for correct depth overlap */
    const sortedElves = this.getSortedElvesByDepth();
    for (const elf of sortedElves) {
      elf.draw(ctx, this.time);
    }

    /* 9. Particles — sparkles, zzz, smoke (drawn above elves) */
    this.particleSystem.draw(ctx);

    this.camera.restore(ctx);

    /* 10. Ambient overlay — dynamic lighting (replaces hardcoded WARM_GLOW_COLOR) */
    ctx.fillStyle = this.ambientEffects.getOverlayColor(this.time);
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  /* ---- Elf Lifecycle ---- */

  /**
   * Spawn a new elf sprite at the workshop door position.
   * The elf starts in 'entering' state and should be directed to a workbench
   * via the EventProcessor's spawn handler.
   *
   * @param id - Unique identifier for this elf (matches ElfEvent.elfId)
   * @param name - Display name shown below the sprite
   * @param hatColor - CSS color for the elf's pointed hat
   * @param accessory - Accessory identifier for the elf's equipment
   */
  spawnElf(
    id: string,
    name: string,
    hatColor: string,
    accessory: string,
  ): void {
    if (this.elves.has(id)) return;

    const doorPixel = this.pathfinder.tileToPixel(DOOR_POS);
    const config = {
      id,
      name,
      position: doorPixel,
      targetPosition: null,
      path: [],
      state: "entering" as const,
      facing: "up" as const,
      animFrame: 0,
      animTimer: 0,
      workbenchId: null,
      workAnimation: "type" as const,
      carryItem: null,
      speechBubble: null,
      actionQueue: [],
      hatColor,
      accessory,
      bodyColor: "#FFD93D",
    };
    const elf = new ElfSprite(config);
    this.elves.set(id, elf);
  }

  /**
   * Remove an elf from the workshop scene.
   * Frees the elf's assigned workbench before deletion.
   *
   * @param id - The elf's unique identifier
   */
  removeElf(id: string): void {
    const elf = this.elves.get(id);
    if (!elf) return;

    /* Free the workbench this elf was assigned to */
    const benchId = elf.getWorkbenchId();
    if (benchId !== null) {
      const bench = WORKBENCHES.find((wb) => wb.id === benchId);
      if (bench) {
        bench.assignedElfId = null;
      }
    }

    this.elves.delete(id);
  }

  /**
   * Retrieve an elf sprite by its unique identifier.
   * Returns undefined if no elf with the given id exists in the scene.
   */
  getElf(id: string): ElfSprite | undefined {
    return this.elves.get(id);
  }

  /**
   * Get all elf sprites currently in the workshop.
   * Returns an array for iteration; does not guarantee order.
   */
  getAllElves(): ElfSprite[] {
    return Array.from(this.elves.values());
  }

  /* ---- Event Processing ---- */

  /**
   * Process a unified ElfEvent from the agent protocol stream.
   * Delegates to EventProcessor which maps events to visual actions.
   *
   * @param event - The ElfEvent to process
   */
  processElfEvent(event: ElfEvent): void {
    this.eventProcessor.processEvent(event, this);
  }

  /* ---- Hit Testing ---- */

  /**
   * Find the interactive target at the given screen coordinates.
   * Used by the React overlay for tooltip positioning and cursor management.
   *
   * @param screenX - X coordinate relative to canvas
   * @param screenY - Y coordinate relative to canvas
   * @returns The target under the cursor, or null if empty space
   */
  getTargetAt(screenX: number, screenY: number): InteractionTarget | null {
    /* Check elves first (closest by distance) */
    let closestElf: string | null = null;
    let closestDistance = ST * ST * 1.5;

    for (const elf of this.elves.values()) {
      const position = elf.getPosition();
      const dx = screenX - position.x;
      const dy = screenY - position.y;
      const distSquared = dx * dx + dy * dy;
      if (distSquared < closestDistance) {
        closestDistance = distSquared;
        closestElf = elf.getId();
      }
    }
    if (closestElf !== null) {
      return { kind: 'elf', elfId: closestElf };
    }

    /* Check workbenches */
    for (const bench of WORKBENCHES) {
      const bx = bench.x * ST;
      const by = bench.y * ST;
      if (
        screenX >= bx &&
        screenX <= bx + ST * 3 &&
        screenY >= by &&
        screenY <= by + ST * 2
      ) {
        return { kind: 'workbench', benchId: bench.id };
      }
    }

    return null;
  }

  /* ---- Conveyor Belt ---- */

  /**
   * Add a visual item to the conveyor belt.
   * Items enter from the left and travel rightward until they exit.
   *
   * @param color - CSS color for the item rectangle
   * @param label - Optional short label displayed on the item
   */
  addConveyorItem(color: string, label?: string): void {
    this.conveyorItems.push({
      x: CONVEYOR_ENTER_X,
      color,
      label,
    });
  }

  /**
   * Update conveyor belt items — move them rightward and remove exited items.
   * Also handles ambient auto-spawning of items for visual liveliness.
   */
  private updateConveyor(dt: number): void {
    /* Move all items rightward */
    for (const item of this.conveyorItems) {
      item.x += CONVEYOR_SPEED * dt;
    }

    /* Remove items that have exited the right side */
    while (
      this.conveyorItems.length > 0 &&
      this.conveyorItems[0]!.x > CONVEYOR_EXIT_X
    ) {
      this.conveyorItems.shift();
    }
  }

  /* ---- Particle Emission Helpers ---- */

  /**
   * Emit a burst of sparkle particles at the given position.
   * Used by EventProcessor for tool calls and celebrations.
   *
   * @param x - X pixel position
   * @param y - Y pixel position
   * @param color - CSS color for the sparkles
   * @param count - Number of sparkle particles to emit
   */
  emitSparkles(x: number, y: number, _color: string, count: number): void {
    this.particleSystem.addBurst(x, y, "sparkle", count);
  }

  /**
   * Emit a puff of smoke particles at the given position.
   * Used by EventProcessor for errors and failed tool results.
   *
   * @param x - X pixel position
   * @param y - Y pixel position
   * @param count - Number of smoke particles to emit
   */
  emitSmoke(x: number, y: number, count: number): void {
    this.particleSystem.addBurst(x, y, "smoke", count);
  }

  /* ---- Interaction Forwarding ---- */

  /**
   * Forward mouse move events to the interaction handler.
   * Returns the detected hover target for tooltip rendering.
   */
  handleMouseMove(
    event: MouseEvent,
    canvas: HTMLCanvasElement,
  ): { target: InteractionTarget | null; screenX: number; screenY: number } {
    return this.interactionHandler.handleMouseMove(event, this, canvas);
  }

  /**
   * Forward click events to the interaction handler for target detection and callbacks.
   */
  handleClick(event: MouseEvent, canvas: HTMLCanvasElement): void {
    this.interactionHandler.handleClick(event, this, canvas);
  }

  /**
   * Forward wheel events to the interaction handler for camera zoom.
   */
  handleWheel(event: WheelEvent, canvas: HTMLCanvasElement): void {
    this.interactionHandler.handleWheel(event, this, canvas);
  }

  /**
   * Forward keyboard events to the interaction handler for shortcuts.
   */
  handleKeyDown(event: KeyboardEvent): void {
    this.interactionHandler.handleKeyDown(event, this);
  }

  /**
   * Forward mouse down events to the interaction handler for camera drag start.
   */
  handleMouseDown(event: MouseEvent, canvas: HTMLCanvasElement): void {
    this.interactionHandler.handleMouseDown(event, this, canvas);
  }

  /**
   * Forward mouse up events to the interaction handler for camera drag end.
   */
  handleMouseUp(): void {
    this.interactionHandler.handleMouseUp();
  }

  /* ---- New Subsystem Accessors ---- */

  /** Get the behavior sequencer for delivery walks and ceremonies. */
  getBehaviorSequencer(): BehaviorSequencer {
    return this.behaviorSequencer;
  }

  /** Get the ambient effects system for triggering flickers. */
  getAmbientEffects(): AmbientEffects {
    return this.ambientEffects;
  }

  /** Get the pathfinder for path computation. */
  getPathfinder(): Pathfinder {
    return this.pathfinder;
  }

  /**
   * Walk an elf to a target position using A* pathfinding.
   * Converts pixel positions to tiles, finds a path, and sets the elf walking.
   */
  walkElfTo(elfId: string, targetX: number, targetY: number): void {
    const elf = this.elves.get(elfId);
    if (!elf) return;

    const path = computeElfPath(this.pathfinder, elf.getPosition(), { x: targetX, y: targetY });
    if (path.length > 0) {
      elf.setPath(path);
      elf.transition('walking');
    }
  }

  /** Update task progress counts for cookie jar fill. */
  setTaskProgress(done: number, total: number): void {
    this.tasksDone = done;
    this.tasksTotal = total;
  }

  /** Get the current session elapsed time in seconds. */
  getSessionElapsed(): number {
    return this.sessionElapsed;
  }

  /* ---- Internal Helpers ---- */

  /**
   * Sort elves by Y position for correct depth rendering.
   * Elves further down the screen (higher Y) are drawn last (on top).
   */
  private getSortedElvesByDepth(): ElfSprite[] {
    return Array.from(this.elves.values()).sort((elfA, elfB) => {
      return elfA.getPosition().y - elfB.getPosition().y;
    });
  }

  /**
   * Animate the door open when any elf is entering or exiting,
   * and close it when no elf is near the door.
   */
  private updateDoor(dt: number): void {
    const doorPixel: Vec2 = { x: DOOR_POS.col * ST + ST, y: DOOR_POS.row * ST };
    const doorProximity = ST * 3;
    let elfNearDoor = false;

    for (const elf of this.elves.values()) {
      const state = elf.getState();
      if (state === 'entering' || state === 'exiting') {
        const pos = elf.getPosition();
        const dx = pos.x - doorPixel.x;
        const dy = pos.y - doorPixel.y;
        if (Math.sqrt(dx * dx + dy * dy) < doorProximity) {
          elfNearDoor = true;
          break;
        }
      }
    }

    if (elfNearDoor && this.doorState.animProgress < 1) {
      this.doorState = {
        isOpen: true,
        animProgress: Math.min(1, this.doorState.animProgress + dt * DOOR_ANIM_SPEED),
      };
    } else if (!elfNearDoor && this.doorState.animProgress > 0) {
      const newProgress = Math.max(0, this.doorState.animProgress - dt * DOOR_ANIM_SPEED);
      this.doorState = {
        isOpen: newProgress > 0,
        animProgress: newProgress,
      };
    }
  }
}
