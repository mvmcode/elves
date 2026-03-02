/* MatrixEffect — pixel-art matrix rain effect for elf spawn/despawn animations.
 * Inspired by pixel-agents' matrix spawn effect. Draws falling green "digital rain"
 * columns over the elf's bounding box, revealing (spawn) or dissolving (despawn) the character. */

import { SCALE } from './workshop-layout';

/** Width of the elf bounding box in SCALE units (pixels / SCALE). */
const ELF_WIDTH_UNITS = 18;

/** Height of the elf bounding box in SCALE units. */
const ELF_HEIGHT_UNITS = 28;

/** Duration of the matrix effect in seconds. */
const EFFECT_DURATION_SEC = 0.4;

/** Number of trailing cells behind the rain head. */
const TRAIL_LENGTH = 6;

/** Head glow color — bright green-white. */
const HEAD_COLOR = 'rgba(200, 255, 200, 1)';

/** Trail color base — green, with alpha applied per-cell. */
const TRAIL_R = 0;
const TRAIL_G = 180;
const TRAIL_B = 0;

/**
 * Matrix rain spawn/despawn effect.
 *
 * Creates a column-by-column digital rain animation that either reveals (spawn)
 * or dissolves (despawn) an elf character. Each column starts at a staggered time
 * based on a random seed, creating a cascade effect.
 *
 * Usage:
 * 1. Create with `new MatrixEffect('spawn')` or `new MatrixEffect('despawn')`
 * 2. Call `update(dtSeconds)` each frame — returns true when complete
 * 3. Check `shouldDrawElf` to know whether to render the elf underneath
 * 4. Call `draw(ctx, centerX, baseY)` to render the rain columns
 */
export class MatrixEffect {
  readonly type: 'spawn' | 'despawn';
  private timer: number = 0;
  private readonly columnSeeds: readonly number[];

  constructor(type: 'spawn' | 'despawn') {
    this.type = type;
    this.columnSeeds = Array.from({ length: ELF_WIDTH_UNITS }, () => Math.random());
  }

  /**
   * Advance the effect timer.
   * @returns true when the effect is complete and should be removed.
   */
  update(dtSeconds: number): boolean {
    this.timer += dtSeconds;
    return this.timer >= EFFECT_DURATION_SEC;
  }

  /** Normalized progress from 0 (start) to 1 (complete). */
  get progress(): number {
    return Math.min(this.timer / EFFECT_DURATION_SEC, 1);
  }

  /** Whether the underlying elf sprite should be drawn this frame. */
  get shouldDrawElf(): boolean {
    if (this.type === 'spawn') {
      return this.progress > 0.5;
    }
    return this.progress < 0.5;
  }

  /** Alpha value for the elf sprite when it IS drawn during the effect. */
  get elfAlpha(): number {
    if (this.type === 'spawn') {
      /* Fade in from 0 at 50% to 1 at 100% */
      return Math.max(0, Math.min(1, (this.progress - 0.5) * 2));
    }
    /* Fade out from 1 at 0% to 0 at 50% */
    return Math.max(0, Math.min(1, 1 - this.progress * 2));
  }

  /**
   * Draw the matrix rain columns over the elf's bounding box.
   *
   * @param ctx - Canvas 2D context
   * @param centerX - Elf center X position in canvas pixels
   * @param baseY - Elf base Y position (feet level) in canvas pixels
   */
  draw(ctx: CanvasRenderingContext2D, centerX: number, baseY: number): void {
    const progress = this.progress;
    const cellSize = SCALE;
    const cols = ELF_WIDTH_UNITS;
    const rows = ELF_HEIGHT_UNITS;
    const startX = centerX - (cols * cellSize) / 2;
    const startY = baseY - rows * cellSize;

    for (let c = 0; c < cols; c++) {
      const seed = this.columnSeeds[c]!;
      /* Each column starts at a staggered time based on its seed */
      const columnProgress = Math.max(0, (progress * 1.4 - seed * 0.4));
      const headRow = Math.floor(columnProgress * rows);

      for (let r = Math.max(0, headRow - TRAIL_LENGTH); r <= headRow && r < rows; r++) {
        const isHead = r === headRow;
        const distFromHead = headRow - r;
        const trailAlpha = Math.max(0.1, 1 - distFromHead / TRAIL_LENGTH);

        const px = Math.floor(startX + c * cellSize);
        const py = Math.floor(startY + r * cellSize);

        if (isHead) {
          ctx.fillStyle = HEAD_COLOR;
        } else {
          ctx.fillStyle = `rgba(${TRAIL_R}, ${TRAIL_G}, ${TRAIL_B}, ${trailAlpha * 0.8})`;
        }
        ctx.fillRect(px, py, cellSize, cellSize);
      }
    }
  }
}
