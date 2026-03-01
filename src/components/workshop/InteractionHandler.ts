/* InteractionHandler — manages mouse and keyboard interactions with the workshop scene,
   including camera drag-to-pan, wheel-to-zoom, double-click-to-follow, and KeyF fit-all. */

import type { InteractionTarget, WorkshopCallbacks } from '../../types/workshop';
import type { WorkshopScene } from './WorkshopScene';
import { WORKBENCHES, ST } from './workshop-layout';

/** Pixel radius for elf hit detection from center of sprite */
const ELF_HIT_RADIUS = ST * 1.2;

/** Bounding box dimensions for workbench hit detection (3 tiles wide, 2 tiles tall) */
const BENCH_WIDTH = ST * 3;
const BENCH_HEIGHT = ST * 2;

/** Named furniture bounding boxes for hit detection (in tile coordinates) */
const FURNITURE_BOUNDS = {
  noticeBoard: { col: 23, row: 3, width: 3, height: 2.5 },
  cookieJar: { col: 18, row: 9.5, width: 1.5, height: 1.5 },
  deliveryChute: { col: 1, row: 8, width: 2, height: 1 },
  cots: { col: 23, row: 11, width: 3, height: 4.5 },
  fireplace: { col: 21, row: 13, width: 3, height: 2 },
} as const;

/**
 * Converts a MouseEvent's client coordinates to canvas-local pixel coordinates,
 * accounting for canvas position and any CSS scaling.
 */
function canvasCoords(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

/**
 * Checks whether a point falls within a rectangular bounding box.
 * Used for workbench and furniture hit detection.
 */
function isWithinRect(
  pointX: number,
  pointY: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
): boolean {
  return (
    pointX >= rectX &&
    pointX <= rectX + rectWidth &&
    pointY >= rectY &&
    pointY <= rectY + rectHeight
  );
}

/**
 * Handles all user interactions with the workshop canvas — mouse hover,
 * click detection, wheel events, and keyboard shortcuts.
 *
 * Hit detection priority order:
 * 1. Elves (by distance from center, closest first)
 * 2. Workbenches (by bounding box)
 * 3. Named furniture areas (notice board, cookie jar, delivery chute, cots, fireplace)
 *
 * This ordering ensures that interactive elements on top (elves walking over furniture)
 * receive priority over static background elements.
 */
export class InteractionHandler {
  private readonly callbacks: WorkshopCallbacks;

  /** Tracks whether the mouse is currently being dragged for camera pan. */
  private isDragging: boolean = false;
  private lastDragX: number = 0;
  private lastDragY: number = 0;

  /** Tracks last click time for double-click detection. */
  private lastClickTime: number = 0;
  private lastClickTarget: string | null = null;

  constructor(callbacks: WorkshopCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Handle mouse movement — detect hover targets for cursor changes and tooltips.
   * Converts screen coords to world coords via camera for correct hit testing.
   * Also handles camera pan when dragging.
   */
  handleMouseMove(
    event: MouseEvent,
    scene: WorkshopScene,
    canvas: HTMLCanvasElement,
  ): { target: InteractionTarget | null; screenX: number; screenY: number } {
    const { x, y } = canvasCoords(event, canvas);

    /* Handle camera drag-to-pan */
    if (this.isDragging) {
      const dx = event.clientX - this.lastDragX;
      const dy = event.clientY - this.lastDragY;
      scene.camera.handleDrag(dx, dy);
      this.lastDragX = event.clientX;
      this.lastDragY = event.clientY;
      canvas.style.cursor = 'grabbing';
      return { target: null, screenX: event.clientX, screenY: event.clientY };
    }

    /* Convert screen coords to world coords via camera */
    const world = scene.camera.screenToWorld(x, y);
    const target = this.detectTarget(world.x, world.y, scene);

    canvas.style.cursor = target !== null ? 'pointer' : 'default';

    return {
      target,
      screenX: event.clientX,
      screenY: event.clientY,
    };
  }

  /**
   * Handle mouse click — detect the clicked target and fire the appropriate callback.
   * Converts screen coords to world coords via camera. Double-click on an elf
   * toggles camera follow mode.
   */
  handleClick(
    event: MouseEvent,
    scene: WorkshopScene,
    canvas: HTMLCanvasElement,
  ): void {
    const { x, y } = canvasCoords(event, canvas);
    const world = scene.camera.screenToWorld(x, y);
    const target = this.detectTarget(world.x, world.y, scene);

    /* Double-click detection for elf follow */
    const now = Date.now();
    if (target !== null && target.kind === 'elf') {
      if (
        now - this.lastClickTime < 400 &&
        this.lastClickTarget === target.elfId
      ) {
        /* Double-click on same elf — toggle follow */
        const currentFollow = scene.camera.getState().followTargetId;
        if (currentFollow === target.elfId) {
          scene.camera.setFollowTarget(null);
        } else {
          scene.camera.setFollowTarget(target.elfId);
          const elf = scene.getElf(target.elfId);
          if (elf) {
            scene.camera.followElf(elf.getPosition());
          }
        }
        this.lastClickTime = 0;
        this.lastClickTarget = null;
        return;
      }
      this.lastClickTarget = target.elfId;
    } else {
      this.lastClickTarget = null;
    }
    this.lastClickTime = now;

    if (target === null) return;

    switch (target.kind) {
      case 'elf':
        this.callbacks.onElfClick(target.elfId);
        break;
      case 'workbench':
        this.callbacks.onBenchClick(target.benchId);
        break;
      case 'noticeBoard':
        this.callbacks.onNoticeClick();
        break;
      case 'cookieJar':
        this.callbacks.onCookieClick();
        break;
      case 'deliveryChute':
        this.callbacks.onDeliveryClick();
        break;
      case 'cots':
        this.callbacks.onCotsClick();
        break;
      case 'fireplace':
        this.callbacks.onFireplaceClick();
        break;
    }
  }

  /**
   * Handle mouse wheel — zoom the camera toward the cursor position.
   * Delegates to Camera.handleWheel for zoom-toward-cursor behavior.
   */
  handleWheel(event: WheelEvent, scene: WorkshopScene, canvas: HTMLCanvasElement): void {
    const { x, y } = canvasCoords(event as unknown as MouseEvent, canvas);
    scene.camera.handleWheel(event.deltaY, x, y);
  }

  /**
   * Handle keyboard shortcuts for workshop interaction.
   * - Space: toggle between workshop and card view
   * - 1-6: reserved for bench focus
   * - F: fit all elves in viewport
   * - R: reset camera to default
   * - Escape: deselect current target, release camera follow
   */
  handleKeyDown(event: KeyboardEvent, scene: WorkshopScene): void {
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.callbacks.onViewToggle();
        break;

      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
      case 'Digit6': {
        const benchIndex = parseInt(event.code.replace('Digit', ''), 10) - 1;
        const bench = WORKBENCHES[benchIndex];
        if (benchIndex >= 0 && bench) {
          this.callbacks.onBenchClick(bench.id);
        }
        break;
      }

      case 'KeyF': {
        /* Fit all elves in viewport */
        const positions = scene.getAllElves().map((elf) => elf.getPosition());
        scene.camera.fitAll(positions);
        break;
      }

      case 'KeyR':
        /* Reset camera to default */
        scene.camera.reset();
        break;

      case 'Escape':
        /* Release camera follow and deselect */
        scene.camera.setFollowTarget(null);
        break;
    }
  }

  /**
   * Handle mouse down — begin camera drag if middle button or no target hit.
   * Call from WorkshopCanvas onMouseDown handler.
   */
  handleMouseDown(event: MouseEvent, scene: WorkshopScene, canvas: HTMLCanvasElement): void {
    /* Middle mouse button always starts drag */
    if (event.button === 1) {
      this.isDragging = true;
      this.lastDragX = event.clientX;
      this.lastDragY = event.clientY;
      event.preventDefault();
      return;
    }

    /* Left button drag only when no interactive target */
    if (event.button === 0) {
      const { x, y } = canvasCoords(event, canvas);
      const world = scene.camera.screenToWorld(x, y);
      const target = this.detectTarget(world.x, world.y, scene);
      if (target === null) {
        this.isDragging = true;
        this.lastDragX = event.clientX;
        this.lastDragY = event.clientY;
      }
    }
  }

  /** Handle mouse up — end camera drag. */
  handleMouseUp(): void {
    this.isDragging = false;
  }

  /**
   * Core hit detection — checks all interactive elements at the given canvas coordinates.
   * Returns the highest-priority target or null if nothing is under the cursor.
   *
   * Priority: elves (by closest distance) > workbenches > furniture areas
   */
  private detectTarget(
    canvasX: number,
    canvasY: number,
    scene: WorkshopScene,
  ): InteractionTarget | null {
    /* Check elves first — find the closest one within hit radius */
    const elfTarget = this.detectElfTarget(canvasX, canvasY, scene);
    if (elfTarget !== null) return elfTarget;

    /* Check workbenches */
    const benchTarget = this.detectBenchTarget(canvasX, canvasY);
    if (benchTarget !== null) return benchTarget;

    /* Check named furniture areas */
    const furnitureTarget = this.detectFurnitureTarget(canvasX, canvasY);
    if (furnitureTarget !== null) return furnitureTarget;

    return null;
  }

  /**
   * Detect if any elf sprite is under the cursor.
   * Checks all elves and returns the closest one within ELF_HIT_RADIUS.
   */
  private detectElfTarget(
    canvasX: number,
    canvasY: number,
    scene: WorkshopScene,
  ): InteractionTarget | null {
    let closestId: string | null = null;
    let closestDistanceSquared = ELF_HIT_RADIUS * ELF_HIT_RADIUS;

    for (const elf of scene.getAllElves()) {
      const position = elf.getPosition();
      const dx = canvasX - position.x;
      const dy = canvasY - position.y;
      const distSquared = dx * dx + dy * dy;

      if (distSquared < closestDistanceSquared) {
        closestDistanceSquared = distSquared;
        closestId = elf.getId();
      }
    }

    if (closestId !== null) {
      return { kind: 'elf', elfId: closestId };
    }
    return null;
  }

  /**
   * Detect if any workbench bounding box contains the cursor position.
   */
  private detectBenchTarget(
    canvasX: number,
    canvasY: number,
  ): InteractionTarget | null {
    for (const bench of WORKBENCHES) {
      const benchPixelX = bench.x * ST;
      const benchPixelY = bench.y * ST;

      if (
        isWithinRect(
          canvasX,
          canvasY,
          benchPixelX,
          benchPixelY,
          BENCH_WIDTH,
          BENCH_HEIGHT,
        )
      ) {
        return { kind: 'workbench', benchId: bench.id };
      }
    }
    return null;
  }

  /**
   * Detect if any named furniture area contains the cursor position.
   * Checks notice board, cookie jar, delivery chute, cots, and fireplace.
   */
  private detectFurnitureTarget(
    canvasX: number,
    canvasY: number,
  ): InteractionTarget | null {
    for (const [name, bounds] of Object.entries(FURNITURE_BOUNDS)) {
      if (
        isWithinRect(
          canvasX,
          canvasY,
          bounds.col * ST,
          bounds.row * ST,
          bounds.width * ST,
          bounds.height * ST,
        )
      ) {
        return { kind: name } as InteractionTarget;
      }
    }
    return null;
  }
}
