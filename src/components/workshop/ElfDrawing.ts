/* ElfDrawing — pure stateless render functions for elf sprite drawing, extracted from ElfSprite for reusability and file size reduction. */

import { SCALE } from './workshop-layout';
import type {
  CarryItemType,
  Direction,
  ElfSpriteState,
  SpeechBubbleConfig,
  WorkAnimation,
} from '../../types/workshop';

/** Boot color for all elves. */
export const BOOT_COLOR = '#5A3A2A';

/** Apron color (info blue from design system). */
export const APRON_COLOR = '#4D96FF';

/** Blink occurs every N frames — eyes close for 1 frame out of this cycle. */
export const BLINK_CYCLE = 40;

/** Elf visual properties passed to all drawing functions. */
export interface ElfVisuals {
  readonly x: number;
  readonly y: number;
  readonly bounceY: number;
  readonly hatColor: string;
  readonly bodyColor: string;
  readonly state: ElfSpriteState;
  readonly workAnimation: WorkAnimation;
  readonly facing: Direction;
  readonly carryItem: CarryItemType | null;
  readonly shakeOffset: number;
}

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

/** Draw elliptical shadow under the elf's feet. */
export function drawElfShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + SCALE * 8, SCALE * 4, SCALE * 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw two boots with curled toes at the elf's feet. */
export function drawElfBoots(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
): void {
  drawPixelRect(ctx, x - SCALE * 3, by + SCALE * 4, SCALE * 3, SCALE * 4, BOOT_COLOR);
  drawPixelRect(ctx, x + SCALE, by + SCALE * 4, SCALE * 3, SCALE * 4, BOOT_COLOR);
  drawPixelRect(ctx, x - SCALE * 4, by + SCALE * 6, SCALE * 2, SCALE * 2, BOOT_COLOR);
  drawPixelRect(ctx, x + SCALE * 3, by + SCALE * 6, SCALE * 2, SCALE * 2, BOOT_COLOR);
}

/** Draw the elf's rectangular body with stroke outline. */
export function drawElfBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
  bodyColor: string,
): void {
  drawPixelRect(ctx, x - SCALE * 4, by - SCALE * 4, SCALE * 8, SCALE * 10, bodyColor);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = SCALE * 0.8;
  ctx.strokeRect(x - SCALE * 4, by - SCALE * 4, SCALE * 8, SCALE * 10);
}

/** Draw the blue work apron over the elf's lower body. */
export function drawElfApron(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
): void {
  drawPixelRect(ctx, x - SCALE * 3, by, SCALE * 6, SCALE * 6, APRON_COLOR);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = SCALE * 0.5;
  ctx.strokeRect(x - SCALE * 3, by, SCALE * 6, SCALE * 6);
}

/**
 * Draw state-dependent arm positions.
 * Arms change pose based on the elf's current state, work animation, and carry item.
 */
export function drawElfArms(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
  time: number,
  state: ElfSpriteState,
  workAnimation: WorkAnimation,
  carryItem: CarryItemType | null,
  bodyColor: string,
): void {
  if (state === 'working' && workAnimation === 'type') {
    const armWave = Math.sin(time * 0.015) * SCALE;
    drawPixelRect(ctx, x - SCALE * 6, by - SCALE + armWave, SCALE * 3, SCALE * 3, bodyColor);
    drawPixelRect(ctx, x + SCALE * 4, by - SCALE - armWave, SCALE * 3, SCALE * 3, bodyColor);
  } else if (state === 'working' && workAnimation === 'read') {
    drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 2, SCALE * 3, SCALE * 5, bodyColor);
    drawPixelRect(ctx, x + SCALE * 4, by - SCALE * 2, SCALE * 3, SCALE * 5, bodyColor);
  } else if (carryItem !== null) {
    drawPixelRect(ctx, x - SCALE * 2, by - SCALE * 10, SCALE * 4, SCALE * 3, bodyColor);
    drawPixelRect(ctx, x - SCALE * 3, by - SCALE * 13, SCALE * 6, SCALE * 4, APRON_COLOR);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = SCALE * 0.5;
    ctx.strokeRect(x - SCALE * 3, by - SCALE * 13, SCALE * 6, SCALE * 4);
  } else if (state === 'permission' || state === 'waiting') {
    drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 8, SCALE * 3, SCALE * 5, bodyColor);
    drawPixelRect(ctx, x + SCALE * 4, by - SCALE * 8, SCALE * 3, SCALE * 5, bodyColor);
  } else if (state === 'celebrating') {
    const wave = Math.sin(time * 0.02) * SCALE;
    drawPixelRect(ctx, x - SCALE * 7, by - SCALE * 7 + wave, SCALE * 3, SCALE * 4, bodyColor);
    drawPixelRect(ctx, x + SCALE * 5, by - SCALE * 7 - wave, SCALE * 3, SCALE * 4, bodyColor);
  } else {
    drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 2, SCALE * 3, SCALE * 5, bodyColor);
    drawPixelRect(ctx, x + SCALE * 4, by - SCALE * 2, SCALE * 3, SCALE * 5, bodyColor);
  }
}

/** Draw the elf's rectangular head with stroke outline. */
export function drawElfHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
  bodyColor: string,
): void {
  drawPixelRect(ctx, x - SCALE * 5, by - SCALE * 12, SCALE * 10, SCALE * 9, bodyColor);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = SCALE * 0.8;
  ctx.strokeRect(x - SCALE * 5, by - SCALE * 12, SCALE * 10, SCALE * 9);
}

/** Draw two pointy triangle ears on each side of the head. */
export function drawElfEars(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
  bodyColor: string,
): void {
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = SCALE * 0.8;

  ctx.beginPath();
  ctx.moveTo(x - SCALE * 5, by - SCALE * 8);
  ctx.lineTo(x - SCALE * 9, by - SCALE * 12);
  ctx.lineTo(x - SCALE * 4, by - SCALE * 6);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + SCALE * 5, by - SCALE * 8);
  ctx.lineTo(x + SCALE * 9, by - SCALE * 12);
  ctx.lineTo(x + SCALE * 4, by - SCALE * 6);
  ctx.fill();
  ctx.stroke();
}

/**
 * Draw the elf's eyes with blink cycle and look direction.
 * Eyes blink periodically and shift pupils when the elf is reading.
 */
export function drawElfEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
  time: number,
  workAnimation: WorkAnimation,
): void {
  const blinkPhase = Math.floor(time * 0.004) % BLINK_CYCLE;

  if (blinkPhase === 0) {
    drawPixelRect(ctx, x - SCALE * 3, by - SCALE * 8, SCALE * 2, SCALE, '#000');
    drawPixelRect(ctx, x + SCALE * 1, by - SCALE * 8, SCALE * 2, SCALE, '#000');
  } else {
    drawPixelRect(ctx, x - SCALE * 3, by - SCALE * 9, SCALE * 2, SCALE * 2, '#FFF');
    drawPixelRect(ctx, x + SCALE * 1, by - SCALE * 9, SCALE * 2, SCALE * 2, '#FFF');

    const lookX = workAnimation === 'read' ? -SCALE : 0;
    drawPixelRect(ctx, x - SCALE * 3 + SCALE + lookX, by - SCALE * 9, SCALE, SCALE * 2, '#000');
    drawPixelRect(ctx, x + SCALE * 1 + SCALE + lookX, by - SCALE * 9, SCALE, SCALE * 2, '#000');
  }
}

/** Draw the simple mouth line on the elf's face. */
export function drawElfMouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
): void {
  drawPixelRect(ctx, x - SCALE, by - SCALE * 6, SCALE * 2, SCALE, '#000');
}

/** Draw the pointy hat with brim and white pompom at the tip. */
export function drawElfHat(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
  hatColor: string,
): void {
  ctx.fillStyle = hatColor;
  ctx.beginPath();
  ctx.moveTo(x - SCALE * 5, by - SCALE * 12);
  ctx.lineTo(x, by - SCALE * 20);
  ctx.lineTo(x + SCALE * 5, by - SCALE * 12);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = SCALE * 0.8;
  ctx.stroke();

  drawPixelRect(ctx, x - SCALE * 6, by - SCALE * 13, SCALE * 12, SCALE * 2, hatColor);
  ctx.strokeRect(x - SCALE * 6, by - SCALE * 13, SCALE * 12, SCALE * 2);

  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(x, by - SCALE * 20, SCALE * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Draw the name label below the elf with a dark background pill. */
export function drawElfNameTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  by: number,
  name: string,
): void {
  ctx.font = `${SCALE * 3}px 'Press Start 2P', monospace`;
  const nameWidth = ctx.measureText(name).width;

  drawPixelRect(
    ctx,
    x - nameWidth / 2 - SCALE * 2,
    by + SCALE * 12,
    nameWidth + SCALE * 4,
    SCALE * 5,
    'rgba(0,0,0,0.7)',
  );

  ctx.fillStyle = '#FFF';
  ctx.textAlign = 'center';
  ctx.fillText(name, x, by + SCALE * 16);
}

/** Draw a speech, thought, or alert bubble above the elf. */
export function drawElfSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bubble: SpeechBubbleConfig,
): void {
  const displayText = bubble.icon
    ? `${bubble.icon} ${bubble.text}`
    : bubble.text;

  ctx.font = `${SCALE * 3}px 'Press Start 2P', monospace`;
  const textWidth = ctx.measureText(displayText).width + SCALE * 8;
  const bubbleHeight = SCALE * 8;
  const bubbleX = x - textWidth / 2;
  const bubbleY = y - bubbleHeight;

  ctx.fillStyle = '#FFF';
  ctx.fillRect(bubbleX, bubbleY, textWidth, bubbleHeight);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = SCALE * 0.8;
  ctx.strokeRect(bubbleX, bubbleY, textWidth, bubbleHeight);

  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.moveTo(x - SCALE * 2, bubbleY + bubbleHeight);
  ctx.lineTo(x, bubbleY + bubbleHeight + SCALE * 3);
  ctx.lineTo(x + SCALE * 2, bubbleY + bubbleHeight);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.fillText(displayText, x, bubbleY + SCALE * 5.5);
}
