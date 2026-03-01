/* TilemapExtras — extended scene renderers for delivery chute, clock, cookie jar fill,
   door panels, and decorations (wreaths + hanging lights). Extracted from Tilemap.ts
   to keep each module under 300 lines. */

import type { DoorState } from '../../types/workshop';
import {
  SCALE, ST, COLS,
  C,
  DELIVERY_CHUTE_POS,
  CLOCK_POS,
  COOKIE_JAR_POS,
  DOOR_POS,
  BULB_COLORS,
} from './workshop-layout';

/** Fills a pixel-aligned rectangle on the canvas */
function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height));
}

/**
 * Extended tilemap renderer — draws delivery chute, wall clock, progress-aware
 * cookie jar, animated door panels, and decorative elements (wreaths, hanging lights).
 * Stateless: all dynamic data is passed as parameters.
 */
export class TilemapExtras {

  /**
   * Draw the delivery chute pipe on the left wall where items emerge onto the
   * conveyor belt. A vertical dark-gray pipe rises 2 tiles above the belt row,
   * with an opening at the bottom and a subtle animated drip effect.
   */
  drawDeliveryChute(ctx: CanvasRenderingContext2D, time: number): void {
    const chuteX = DELIVERY_CHUTE_POS.col * ST;
    const chuteBottomY = DELIVERY_CHUTE_POS.row * ST;

    // Vertical pipe body — rises 2 tiles above belt
    const pipeWidth = SCALE * 6;
    const pipeX = chuteX + ST / 2 - pipeWidth / 2;
    const pipeTopY = chuteBottomY - ST * 2;
    const pipeHeight = ST * 2;

    // Outer pipe shell
    fillRect(ctx, pipeX, pipeTopY, pipeWidth, pipeHeight, '#505050');
    // Inner pipe highlight (lighter left edge for depth)
    fillRect(ctx, pipeX + SCALE, pipeTopY, SCALE, pipeHeight, '#686868');
    // Dark right edge for depth
    fillRect(ctx, pipeX + pipeWidth - SCALE, pipeTopY, SCALE, pipeHeight, '#3A3A3A');

    // Pipe cap at top — wider lip
    fillRect(ctx, pipeX - SCALE, pipeTopY, pipeWidth + SCALE * 2, SCALE * 2, '#404040');

    // Opening/mouth at bottom — flared opening where items emerge
    fillRect(ctx, pipeX - SCALE * 2, chuteBottomY - SCALE * 3, pipeWidth + SCALE * 4, SCALE * 4, '#505050');
    // Dark interior of mouth
    fillRect(ctx, pipeX, chuteBottomY - SCALE * 2, pipeWidth, SCALE * 3, '#2A2A2A');

    // Animated drip effect — a small droplet that slides down periodically
    const dripCycle = (time * 0.02) % 60;
    if (dripCycle < 30) {
      const dripY = pipeTopY + (dripCycle / 30) * pipeHeight;
      const dripAlpha = 1 - dripCycle / 30;
      ctx.globalAlpha = dripAlpha * 0.6;
      fillRect(ctx, pipeX + pipeWidth / 2 - SCALE * 0.5, dripY, SCALE, SCALE * 2, '#80A0C0');
      ctx.globalAlpha = 1;
    }

    // Pipe mounting brackets — two small rectangles attaching pipe to wall
    fillRect(ctx, chuteX, pipeTopY + SCALE * 4, SCALE * 3, SCALE * 2, '#404040');
    fillRect(ctx, chuteX, chuteBottomY - ST - SCALE * 2, SCALE * 3, SCALE * 2, '#404040');
  }

  /**
   * Draw a pixel-art wall clock at CLOCK_POS. Round clock face with a gold frame,
   * hour/minute hands that rotate based on elapsed seconds, and tick marks at
   * the 12/3/6/9 positions.
   */
  drawClock(ctx: CanvasRenderingContext2D, elapsedSeconds: number): void {
    const clockCenterX = CLOCK_POS.col * ST + ST / 2;
    const clockCenterY = CLOCK_POS.row * ST + ST / 2;
    const radius = ST * 0.4;

    // Gold frame ring (slightly larger than face)
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.arc(clockCenterX, clockCenterY, radius + SCALE * 2, 0, Math.PI * 2);
    ctx.fill();

    // Black border ring
    ctx.strokeStyle = '#000';
    ctx.lineWidth = SCALE;
    ctx.beginPath();
    ctx.arc(clockCenterX, clockCenterY, radius + SCALE * 2, 0, Math.PI * 2);
    ctx.stroke();

    // Cream clock face
    ctx.fillStyle = '#E8E0D0';
    ctx.beginPath();
    ctx.arc(clockCenterX, clockCenterY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Tick marks at 12, 3, 6, 9 positions
    ctx.fillStyle = '#000';
    const tickLength = SCALE * 2;
    const tickPositions = [
      { angle: -Math.PI / 2, label: '12' },
      { angle: 0, label: '3' },
      { angle: Math.PI / 2, label: '6' },
      { angle: Math.PI, label: '9' },
    ];
    for (const tick of tickPositions) {
      const innerR = radius - tickLength;
      const outerR = radius;
      const x1 = clockCenterX + Math.cos(tick.angle) * innerR;
      const y1 = clockCenterY + Math.sin(tick.angle) * innerR;
      const x2 = clockCenterX + Math.cos(tick.angle) * outerR;
      const y2 = clockCenterY + Math.sin(tick.angle) * outerR;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = SCALE;
      ctx.stroke();
    }

    // Hour hand — rotates once per 3600 elapsed seconds (1 hour cycle)
    const hourAngle = -Math.PI / 2 + (elapsedSeconds / 3600) * Math.PI * 2;
    const hourLength = radius * 0.5;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = SCALE * 1.5;
    ctx.beginPath();
    ctx.moveTo(clockCenterX, clockCenterY);
    ctx.lineTo(
      clockCenterX + Math.cos(hourAngle) * hourLength,
      clockCenterY + Math.sin(hourAngle) * hourLength,
    );
    ctx.stroke();

    // Minute hand — rotates once per 60 elapsed seconds
    const minuteAngle = -Math.PI / 2 + (elapsedSeconds / 60) * Math.PI * 2;
    const minuteLength = radius * 0.75;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = SCALE;
    ctx.beginPath();
    ctx.moveTo(clockCenterX, clockCenterY);
    ctx.lineTo(
      clockCenterX + Math.cos(minuteAngle) * minuteLength,
      clockCenterY + Math.sin(minuteAngle) * minuteLength,
    );
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(clockCenterX, clockCenterY, SCALE, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw the cookie jar with fill level proportional to completed tasks.
   * Empty jar when tasksDone=0, full jar when tasksDone=tasksTotal.
   * Cookie colors: #D4A056 body with #5A3A2A chocolate chips.
   */
  drawCookieJarFill(
    ctx: CanvasRenderingContext2D,
    _time: number,
    tasksDone: number,
    tasksTotal: number,
  ): void {
    const jarX = COOKIE_JAR_POS.col * ST;
    const jarY = 9.5 * ST;

    // Jar body — ceramic/glass container
    fillRect(ctx, jarX, jarY + SCALE * 3, ST * 1.5, ST * 1.5, '#C0A880');
    // Jar neck — slightly narrower
    fillRect(ctx, jarX + SCALE, jarY + SCALE * 2, ST * 1.5 - SCALE * 2, SCALE * 2, '#D0B890');
    // Lid — slightly wider than neck
    fillRect(ctx, jarX - SCALE, jarY + SCALE, ST * 1.5 + SCALE * 2, SCALE * 3, '#A08060');

    // Calculate fill ratio — clamp to [0, 1]
    const fillRatio = tasksTotal > 0 ? Math.min(1, Math.max(0, tasksDone / tasksTotal)) : 0;

    if (fillRatio <= 0) return;

    // Cookie fill area inside jar body
    const jarInnerX = jarX + SCALE * 2;
    const jarInnerWidth = ST * 1.5 - SCALE * 4;
    const jarInnerTop = jarY + SCALE * 4;
    const jarInnerHeight = ST * 1.5 - SCALE * 3;

    // Fill from bottom up based on ratio
    const cookieFillHeight = jarInnerHeight * fillRatio;
    const cookieFillY = jarInnerTop + jarInnerHeight - cookieFillHeight;

    // Cookie mass — layered cookie color
    fillRect(ctx, jarInnerX, cookieFillY, jarInnerWidth, cookieFillHeight, '#D4A056');

    // Chocolate chips scattered across the visible cookie fill
    const chipCount = Math.floor(fillRatio * 6);
    for (let chipIndex = 0; chipIndex < chipCount; chipIndex++) {
      // Deterministic positions based on index, with subtle wobble from time
      const chipLocalX = ((chipIndex * 7 + 3) % 5) * SCALE;
      const chipLocalY = ((chipIndex * 5 + 2) % 4) * SCALE;
      const chipY = cookieFillY + chipLocalY + SCALE;
      if (chipY < jarInnerTop + jarInnerHeight - SCALE) {
        fillRect(ctx, jarInnerX + chipLocalX + SCALE, chipY, SCALE, SCALE, '#5A3A2A');
      }
    }
  }

  /**
   * Draw the workshop door panels that swing open/closed based on door state.
   * Two panels slide apart when animProgress goes from 0 (closed) to 1 (open).
   */
  drawDoor(ctx: CanvasRenderingContext2D, doorState: DoorState): void {
    const doorCol = DOOR_POS.col;
    const doorRow = DOOR_POS.row;
    const doorX = doorCol * ST;
    const doorY = doorRow * ST;
    const panelWidth = ST;

    // Opening offset — each panel slides outward by half the total opening distance
    const maxSlide = ST * 0.8;
    const slideOffset = doorState.animProgress * maxSlide;

    // Left panel — slides left when opening
    fillRect(
      ctx,
      doorX - slideOffset,
      doorY + SCALE * 2,
      panelWidth,
      ST - SCALE * 2,
      '#4A2E18',
    );
    // Left panel inner detail
    fillRect(
      ctx,
      doorX - slideOffset + SCALE * 2,
      doorY + SCALE * 4,
      panelWidth - SCALE * 4,
      ST - SCALE * 6,
      '#5A3E28',
    );

    // Right panel — slides right when opening
    fillRect(
      ctx,
      doorX + panelWidth + slideOffset,
      doorY + SCALE * 2,
      panelWidth,
      ST - SCALE * 2,
      '#4A2E18',
    );
    // Right panel inner detail
    fillRect(
      ctx,
      doorX + panelWidth + slideOffset + SCALE * 2,
      doorY + SCALE * 4,
      panelWidth - SCALE * 4,
      ST - SCALE * 6,
      '#5A3E28',
    );

    // Door handle on right panel (only visible when mostly closed)
    if (doorState.animProgress < 0.5) {
      fillRect(
        ctx,
        doorX + panelWidth + slideOffset + SCALE * 2,
        doorY + ST / 2,
        SCALE * 2,
        SCALE * 2,
        C.gold,
      );
    }
  }

  /**
   * Draw decorative elements: green wreaths on the top wall and a string of
   * hanging lights with colored bulbs that flicker over time.
   * Extracted from Tilemap.drawDecorations — identical rendering logic.
   */
  drawDecorations(ctx: CanvasRenderingContext2D, time: number): void {
    // Wreaths on wall at specific positions
    this.drawWreath(ctx, 7 * ST, 2.4 * ST);
    this.drawWreath(ctx, 17 * ST, 2.4 * ST);

    // Hanging lights string along the top wall interior
    ctx.strokeStyle = '#333';
    ctx.lineWidth = SCALE * 0.5;
    ctx.beginPath();
    ctx.moveTo(1 * ST, 2.8 * ST);
    for (let col = 1; col < COLS - 1; col++) {
      const sag = Math.sin(col * 0.5) * SCALE * 2;
      ctx.lineTo(col * ST + ST / 2, 2.8 * ST + sag);
    }
    ctx.stroke();

    // Colored light bulbs every 2 columns
    for (let col = 2; col < COLS - 1; col += 2) {
      const sag = Math.sin(col * 0.5) * SCALE * 2;
      const flickerBrightness = Math.sin(time * 0.003 + col) * 0.3 + 0.7;
      const bulbColor = BULB_COLORS[col % BULB_COLORS.length]!;
      ctx.globalAlpha = flickerBrightness;
      ctx.fillStyle = bulbColor;
      ctx.fillRect(col * ST + ST / 2 - SCALE, 2.8 * ST + sag, SCALE * 2, SCALE * 2);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Draw a single green wreath with a red bow at the bottom.
   * Used on walls as seasonal decoration.
   */
  private drawWreath(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    ctx.fillStyle = C.green;
    // Circle of green blocks forming the wreath ring
    for (let angle = 0; angle < Math.PI * 2; angle += 0.6) {
      ctx.fillRect(
        centerX + Math.cos(angle) * SCALE * 3 - SCALE,
        centerY + Math.sin(angle) * SCALE * 3 - SCALE,
        SCALE * 3,
        SCALE * 3,
      );
    }
    // Red bow at the bottom
    fillRect(ctx, centerX - SCALE, centerY + SCALE * 3, SCALE * 3, SCALE * 2, '#D04040');
  }
}
