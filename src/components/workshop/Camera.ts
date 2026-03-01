/* Camera — viewport transform system for zoom, pan, and follow in the workshop scene. */

import type { CameraConfig, CameraState, Vec2 } from '../../types/workshop';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './workshop-layout';

/** Default camera configuration constants. */
const DEFAULT_CONFIG: CameraConfig = {
  minZoom: 1,
  maxZoom: 4,
  panSpeed: 1,
  zoomStep: 0.15,
  followLerp: 0.08,
};

/**
 * Viewport camera controlling zoom, pan, and elf-follow behavior.
 *
 * Works by storing target values (x, y, zoom) and smoothly interpolating
 * the actual values toward them each frame via linear interpolation.
 * `applyTransform` translates to canvas center, scales, then translates
 * by the negative camera position — producing a world-space viewport.
 */
export class Camera {
  private readonly config: CameraConfig;

  /** Current interpolated camera position and zoom. */
  private current: { x: number; y: number; zoom: number };

  /** Target values the camera lerps toward. */
  private target: { x: number; y: number; zoom: number };

  /** ID of the elf being followed, or null for free camera. */
  private followTargetId: string | null = null;

  /** Pixel position of the follow target, updated externally via followElf(). */
  private followPosition: Vec2 | null = null;

  constructor(config?: Partial<CameraConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.current = { x: 0, y: 0, zoom: 1 };
    this.target = { x: 0, y: 0, zoom: 1 };
  }

  /**
   * Apply the camera transform to a canvas context.
   * Translates to canvas center, scales, then translates by negative camera position.
   * Must be paired with a `restore()` call after drawing.
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(this.current.zoom, this.current.zoom);
    ctx.translate(-centerX - this.current.x, -centerY - this.current.y);
  }

  /** Restore canvas context after camera-transformed drawing. */
  restore(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  /**
   * Convert screen-space coordinates to world-space coordinates.
   * Inverse of the camera transform — used for hit testing clicks against world objects.
   */
  screenToWorld(screenX: number, screenY: number): Vec2 {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    return {
      x: (screenX - centerX) / this.current.zoom + centerX + this.current.x,
      y: (screenY - centerY) / this.current.zoom + centerY + this.current.y,
    };
  }

  /**
   * Convert world-space coordinates to screen-space coordinates.
   * Forward camera transform — used for positioning HTML overlays on canvas elements.
   */
  worldToScreen(worldX: number, worldY: number): Vec2 {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    return {
      x: (worldX - centerX - this.current.x) * this.current.zoom + centerX,
      y: (worldY - centerY - this.current.y) * this.current.zoom + centerY,
    };
  }

  /**
   * Handle mouse wheel zoom toward the cursor position.
   * Zooms in/out by config.zoomStep, clamped to [minZoom, maxZoom].
   * Adjusts camera position so the world point under the cursor stays fixed.
   */
  handleWheel(deltaY: number, mouseX: number, mouseY: number): void {
    const direction = deltaY > 0 ? -1 : 1;
    const oldZoom = this.target.zoom;
    const newZoom = clamp(
      oldZoom + direction * this.config.zoomStep,
      this.config.minZoom,
      this.config.maxZoom,
    );

    if (newZoom === oldZoom) return;

    // Adjust position so the point under the cursor stays fixed
    const worldBefore = this.screenToWorldAtZoom(mouseX, mouseY, oldZoom);
    const worldAfter = this.screenToWorldAtZoom(mouseX, mouseY, newZoom);

    this.target.x += worldBefore.x - worldAfter.x;
    this.target.y += worldBefore.y - worldAfter.y;
    this.target.zoom = newZoom;
  }

  /**
   * Pan the camera by a pixel delta, scaled by panSpeed.
   * Clears follow target since the user is manually navigating.
   */
  handleDrag(dx: number, dy: number): void {
    this.followTargetId = null;
    this.followPosition = null;
    this.target.x -= dx * this.config.panSpeed / this.current.zoom;
    this.target.y -= dy * this.config.panSpeed / this.current.zoom;
  }

  /**
   * Set the camera to follow an elf position with smooth tracking.
   * Call each frame with the elf's updated position; the camera will lerp toward it.
   */
  followElf(position: Vec2): void {
    this.followPosition = position;
  }

  /** Set the ID of the elf being followed (for state reporting). */
  setFollowTarget(elfId: string | null): void {
    this.followTargetId = elfId;
    if (elfId === null) {
      this.followPosition = null;
    }
  }

  /**
   * Adjust zoom and position to fit all given positions within the viewport.
   * Adds padding so elves are not pressed against edges.
   */
  fitAll(positions: Vec2[]): void {
    if (positions.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const pos of positions) {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }

    const padding = 100;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const zoomX = CANVAS_WIDTH / contentWidth;
    const zoomY = CANVAS_HEIGHT / contentHeight;
    const fitZoom = clamp(
      Math.min(zoomX, zoomY),
      this.config.minZoom,
      this.config.maxZoom,
    );

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.target.zoom = fitZoom;
    this.target.x = centerX - CANVAS_WIDTH / 2;
    this.target.y = centerY - CANVAS_HEIGHT / 2;
  }

  /**
   * Advance camera interpolation by one frame.
   * Lerps current values toward target values. If following an elf,
   * updates target position to track the follow target.
   * @param dt - Delta time in normalized frames (~1.0 at 60fps)
   */
  update(dt: number): void {
    // If following an elf, update target to center on them
    if (this.followPosition !== null) {
      this.target.x = this.followPosition.x - CANVAS_WIDTH / 2;
      this.target.y = this.followPosition.y - CANVAS_HEIGHT / 2;
    }

    const lerpFactor = 1 - Math.pow(1 - this.config.followLerp, dt);

    this.current.x += (this.target.x - this.current.x) * lerpFactor;
    this.current.y += (this.target.y - this.current.y) * lerpFactor;
    this.current.zoom += (this.target.zoom - this.current.zoom) * lerpFactor;
  }

  /** Return a snapshot of the current camera state. */
  getState(): CameraState {
    return {
      x: this.current.x,
      y: this.current.y,
      zoom: this.current.zoom,
      followTargetId: this.followTargetId,
    };
  }

  /** Reset camera to default position (origin) and zoom (1x). */
  reset(): void {
    this.target = { x: 0, y: 0, zoom: 1 };
    this.current = { x: 0, y: 0, zoom: 1 };
    this.followTargetId = null;
    this.followPosition = null;
  }

  /** Inverse screen-to-world calculation at a specific zoom level (used for zoom-toward-cursor). */
  private screenToWorldAtZoom(screenX: number, screenY: number, zoom: number): Vec2 {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    return {
      x: (screenX - centerX) / zoom + centerX + this.target.x,
      y: (screenY - centerY) / zoom + centerY + this.target.y,
    };
  }
}

/** Clamp a number between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
