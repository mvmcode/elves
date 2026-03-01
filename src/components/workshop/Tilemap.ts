/* Tilemap — renders the core pixel-art workshop scene onto a 2D canvas.
   Handles sky, walls, floor, conveyor belt, workbenches, fireplace, cots,
   and notice board. Decorations, cookie jar, delivery chute, clock, and door
   are handled by TilemapExtras.ts. All coordinates and colors are sourced
   from workshop-layout.ts to maintain a single source of truth. */

import type { ConveyorItemConfig } from '../../types/workshop';
import {
  SCALE, ST, COLS, ROWS,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  C,
  WINDOW_COLS,
  TREE_COLS,
  STAR_POSITIONS,
  STOCKING_COLORS,
  DOOR_POS,
  FIREPLACE_POS,
  COTS_POS,
  NOTICE_BOARD_POS,
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

/** Fills a full tile at the given grid coordinates */
function fillTile(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  color: string,
): void {
  fillRect(ctx, col * ST, row * ST, ST, ST, color);
}

/**
 * Workshop tilemap renderer — draws every static and animated element
 * of the pixel-art workshop scene. Stateless: receives time and items
 * as parameters, owns no mutable state.
 */
export class Tilemap {
  readonly canvasWidth = CANVAS_WIDTH;
  readonly canvasHeight = CANVAS_HEIGHT;

  /**
   * Draw the night sky backdrop with gradient, twinkling stars,
   * crescent moon, tree silhouettes, and snow on the ground.
   * Occupies rows 0-1 (the area above the workshop walls).
   */
  drawSky(ctx: CanvasRenderingContext2D, time: number): void {
    // Gradient sky — 5 horizontal bands from dark to slightly lighter
    for (let band = 0; band < 5; band++) {
      const t = band / 5;
      const red = Math.floor(26 + t * 16);
      const green = Math.floor(26 + t * 16);
      const blue = Math.floor(62 + t * 20);
      fillRect(ctx, 0, band * ST * 0.5, CANVAS_WIDTH, ST * 0.5, `rgb(${red},${green},${blue})`);
    }

    // Twinkling stars
    ctx.fillStyle = '#FFF';
    for (const [starX, starY] of STAR_POSITIONS) {
      const twinkle = Math.sin(time * 0.003 + starX) * 0.5 + 0.5;
      ctx.globalAlpha = 0.3 + twinkle * 0.7;
      ctx.fillRect(starX * SCALE, starY, SCALE, SCALE);
    }
    ctx.globalAlpha = 1;

    // Crescent moon — full circle minus an offset circle to create crescent
    ctx.fillStyle = '#F0E8D0';
    ctx.beginPath();
    ctx.arc(22 * ST, 0.8 * ST, ST * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.sky;
    ctx.beginPath();
    ctx.arc(22 * ST + ST * 0.2, 0.7 * ST, ST * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Tree silhouettes — layered triangles with a trunk
    ctx.fillStyle = '#1A3020';
    for (const treeCol of TREE_COLS) {
      const treeHeight = 1.2 + Math.sin(treeCol) * 0.3;
      for (let layer = 0; layer < 4; layer++) {
        const layerWidth = (4 - layer) * ST * 0.4;
        const layerY = (2 - treeHeight + layer * 0.3) * ST;
        fillRect(ctx, treeCol * ST + ST / 2 - layerWidth / 2, layerY, layerWidth, ST * 0.35, '#1A3020');
      }
      // Trunk
      fillRect(ctx, treeCol * ST + ST * 0.35, (2 - 0.2) * ST, ST * 0.3, ST * 0.4, '#2A1A10');
    }

    // Snow on ground along the top edge of the workshop
    for (let col = 0; col < COLS; col++) {
      fillRect(ctx, col * ST, 1.7 * ST, ST, ST * 0.3, C.snow);
    }
  }

  /**
   * Draw the workshop walls — top wall with windows, side walls,
   * bottom wall with door. Log-cabin style with gold trim lines.
   */
  drawWalls(ctx: CanvasRenderingContext2D): void {
    // Top wall — log fill with gold trim at top and bottom edges
    for (let col = 0; col < COLS; col++) {
      fillTile(ctx, col, 2, C.wallLog);
      fillRect(ctx, col * ST, 2 * ST, ST, SCALE * 2, C.wallTrim);
      fillRect(ctx, col * ST, 2.9 * ST, ST, SCALE * 2, C.wallTrim);
    }

    // Windows in top wall — blue panes with cross-shaped frames
    for (const windowCol of WINDOW_COLS) {
      const wx = windowCol * ST;
      const wy = 2 * ST;
      // Outer pane
      fillRect(ctx, wx + SCALE * 2, wy + SCALE * 3, ST - SCALE * 4, ST - SCALE * 5, C.windowBlue);
      // Inner lighter pane
      fillRect(ctx, wx + SCALE * 3, wy + SCALE * 4, ST - SCALE * 6, ST - SCALE * 7, C.windowLight);
      // Vertical frame bar
      fillRect(ctx, wx + ST / 2 - SCALE, wy + SCALE * 3, SCALE * 2, ST - SCALE * 5, C.wallTrim);
      // Horizontal frame bar
      fillRect(ctx, wx + SCALE * 2, wy + ST / 2, ST - SCALE * 4, SCALE * 2, C.wallTrim);
    }

    // Side walls — log fill with darker edge accent
    for (let row = 2; row < ROWS; row++) {
      // Left wall
      fillTile(ctx, 0, row, C.wallLog);
      fillRect(ctx, 0, row * ST, SCALE * 2, ST, C.wallLog2);
      // Right wall
      fillTile(ctx, COLS - 1, row, C.wallLog);
      fillRect(ctx, (COLS - 1) * ST + ST - SCALE * 2, row * ST, SCALE * 2, ST, C.wallLog2);
    }

    // Bottom wall — log fill with gold trim at top edge
    for (let col = 0; col < COLS; col++) {
      fillTile(ctx, col, ROWS - 1, C.wallLog);
      fillRect(ctx, col * ST, (ROWS - 1) * ST, ST, SCALE * 2, C.wallTrim);
    }

    // Door in bottom wall — darker wood with gold handle
    const doorCol = DOOR_POS.col;
    const doorRow = DOOR_POS.row;
    fillRect(ctx, doorCol * ST, doorRow * ST, ST * 2, ST, '#4A2E18');
    fillRect(ctx, doorCol * ST + SCALE * 2, doorRow * ST + SCALE * 2, ST * 2 - SCALE * 4, ST - SCALE * 2, '#5A3E28');
    // Gold door handle
    fillRect(ctx, 14.5 * ST, (ROWS - 0.5) * ST, SCALE * 2, SCALE * 2, C.gold);
  }

  /**
   * Draw the wood plank floor for all interior tiles.
   * Uses 3-color variation based on (col+row) modulus for visual interest.
   * Includes thin plank lines at the bottom edge of each tile.
   * Also draws the carpet area near the fireplace.
   */
  drawFloor(ctx: CanvasRenderingContext2D): void {
    for (let row = 3; row < ROWS - 1; row++) {
      for (let col = 1; col < COLS - 1; col++) {
        // Skip conveyor belt row — drawn separately
        if (row === 8) continue;

        const colorIndex = (col + row) % 3;
        const floorColor = colorIndex === 0 ? C.floorWood3
          : colorIndex === 2 ? C.floorWood
          : C.floorWood2;
        fillTile(ctx, col, row, floorColor);

        // Plank line at bottom edge of each tile
        fillRect(ctx, col * ST, row * ST + ST - SCALE, ST, SCALE, C.floorWood3);
      }
    }

    // Carpet area near fireplace — checkerboard red pattern
    for (let row = 13; row < 16; row++) {
      for (let col = 15; col < 20; col++) {
        const carpetColor = (col + row) % 2 === 0 ? C.carpet : C.carpetLight;
        fillTile(ctx, col, row, carpetColor);
      }
    }
  }

  /**
   * Draw the animated conveyor belt spanning row 8.
   * Belt has scrolling diagonal stripes and dark edge rails.
   * Items ride on top of the belt and scroll left-to-right.
   */
  drawConveyorBelt(
    ctx: CanvasRenderingContext2D,
    time: number,
    items: readonly ConveyorItemConfig[],
  ): void {
    const stripeOffset = Math.floor(time * 0.03) % (SCALE * 4);

    for (let col = 1; col < COLS - 1; col++) {
      // Belt base
      fillTile(ctx, col, 8, C.conveyorA);

      // Animated scrolling stripes
      for (let stripe = -1; stripe < ST / (SCALE * 4) + 1; stripe++) {
        const stripeX = col * ST + stripe * SCALE * 4 + stripeOffset;
        fillRect(ctx, stripeX, 8 * ST + SCALE * 2, SCALE * 2, ST - SCALE * 4, C.conveyorB);
      }

      // Top and bottom edge rails
      fillRect(ctx, col * ST, 8 * ST, ST, SCALE * 2, C.conveyorC);
      fillRect(ctx, col * ST, 8 * ST + ST - SCALE * 2, ST, SCALE * 2, C.conveyorC);
    }

    // Render items riding the belt
    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillRect(
        Math.floor(item.x),
        8 * ST + ST / 2 - SCALE * 3,
        SCALE * 4,
        SCALE * 4,
      );
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.floor(item.x),
        8 * ST + ST / 2 - SCALE * 3,
        SCALE * 4,
        SCALE * 4,
      );
    }
  }

  /**
   * Draw a single workbench with body, top surface, legs, border,
   * and theme-specific decorations (tools, monitors, papers, etc.).
   * Each bench is 3 tiles wide and 2 tiles tall.
   *
   * Theme indices:
   *   0=Mechanical (gears), 1=Research (scrolls), 2=Code (monitor),
   *   3=Testing (beakers), 4=Architecture (blueprint), 5=Writing (paper+pen)
   */
  drawWorkbench(
    ctx: CanvasRenderingContext2D,
    benchCol: number,
    benchRow: number,
    theme: number,
    time: number,
  ): void {
    const x = benchCol * ST;
    const y = benchRow * ST;

    // Bench body
    fillRect(ctx, x, y, ST * 3, ST * 2, C.bench);
    // Top surface — lighter wood strip along the front edge
    fillRect(ctx, x + SCALE, y + SCALE, ST * 3 - SCALE * 2, SCALE * 3, C.benchTop);
    // Legs — two dark supports at left and right
    fillRect(ctx, x + SCALE * 2, y + ST * 2 - SCALE * 3, SCALE * 2, SCALE * 3, C.benchDark);
    fillRect(ctx, x + ST * 3 - SCALE * 4, y + ST * 2 - SCALE * 3, SCALE * 2, SCALE * 3, C.benchDark);
    // Black outline border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = SCALE;
    ctx.strokeRect(x, y, ST * 3, ST * 2);

    // Theme-specific decorations with subtle wobble animation
    const wobble = Math.sin(time * 0.005 + benchCol) * SCALE * 0.5;

    switch (theme) {
      case 0: // Mechanical — gear and metal bar
        fillRect(ctx, x + SCALE * 4, y + SCALE * 2 + wobble, SCALE * 3, SCALE * 3, '#808080');
        fillRect(ctx, x + ST * 2, y + SCALE * 2, SCALE * 4, SCALE * 2, '#606060');
        break;
      case 1: // Research — scrolls/papers
        fillRect(ctx, x + SCALE * 4, y + SCALE * 2, SCALE * 5, SCALE * 3, '#E8E0D0');
        fillRect(ctx, x + ST * 2, y + SCALE * 2 + wobble, SCALE * 4, SCALE * 3, '#E8E0D0');
        break;
      case 2: // Code — monitor with green text
        fillRect(ctx, x + SCALE * 3, y + SCALE * 2, SCALE * 6, SCALE * 4, '#333');
        fillRect(ctx, x + SCALE * 4, y + SCALE * 3, SCALE * 4, SCALE * 2, '#40FF40');
        break;
      case 3: // Testing — colored beakers
        fillRect(ctx, x + SCALE * 4, y + SCALE * 2, SCALE * 2, SCALE * 4, '#80E0E0');
        fillRect(ctx, x + ST * 2, y + SCALE * 2 + wobble, SCALE * 2, SCALE * 4, '#E080E0');
        break;
      case 4: // Architecture — blueprint with lines
        fillRect(ctx, x + SCALE * 4, y + SCALE * 2, SCALE * 6, SCALE * 4, '#E0D8C0');
        fillRect(ctx, x + SCALE * 5, y + SCALE * 3, SCALE * 2, SCALE, '#4060A0');
        fillRect(ctx, x + SCALE * 8, y + SCALE * 3, SCALE * 1, SCALE * 2, '#4060A0');
        break;
      case 5: // Writing — paper with text line
        fillRect(ctx, x + SCALE * 4, y + SCALE * 2, SCALE * 5, SCALE * 3, '#E8E0D0');
        fillRect(ctx, x + SCALE * 5, y + SCALE * 3, SCALE * 3, SCALE, '#333');
        break;
    }
  }

  /**
   * Draw the fireplace with stone structure, animated flames,
   * warm radial glow overlay, and colored stockings on the mantle.
   * Located at FIREPLACE_POS (col 21, row 13), 3 tiles wide, 2 tiles tall.
   */
  drawFireplace(ctx: CanvasRenderingContext2D, time: number): void {
    const fx = FIREPLACE_POS.col * ST;
    const fy = FIREPLACE_POS.row * ST;

    // Stone fireplace structure
    fillRect(ctx, fx, fy, ST * 3, ST * 2, '#5A3A2A');
    // Dark inner hearth
    fillRect(ctx, fx + SCALE * 2, fy + SCALE * 4, ST * 3 - SCALE * 4, ST * 2 - SCALE * 4, '#2A1A10');
    // Gold mantle shelf across the top
    fillRect(ctx, fx - SCALE * 2, fy - SCALE * 2, ST * 3 + SCALE * 4, SCALE * 4, C.wallTrim);
    // Black outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = SCALE;
    ctx.strokeRect(fx, fy, ST * 3, ST * 2);

    // Animated fire — 3 flame columns that wave and pulse
    const fireColors = [C.fireRed, C.fireOrange, C.fireYellow];
    for (let flameIndex = 0; flameIndex < 3; flameIndex++) {
      const wave = Math.sin(time * 0.008 + flameIndex * 2) * SCALE * 2;
      const flameHeight = (8 + Math.sin(time * 0.006 + flameIndex) * 3) * SCALE;
      ctx.fillStyle = fireColors[flameIndex]!;
      ctx.fillRect(
        fx + SCALE * 4 + flameIndex * SCALE * 4 + wave,
        fy + ST * 2 - SCALE * 4 - flameHeight,
        SCALE * 4,
        flameHeight,
      );
    }

    // Warm radial glow — fades outward from hearth center
    const gradient = ctx.createRadialGradient(
      fx + ST * 1.5, fy + ST, 0,
      fx + ST * 1.5, fy + ST, ST * 4,
    );
    gradient.addColorStop(0, 'rgba(255,150,50,0.08)');
    gradient.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(fx - ST * 3, fy - ST * 3, ST * 9, ST * 8);

    // Stockings hanging from mantle
    for (let stockingIndex = 0; stockingIndex < STOCKING_COLORS.length; stockingIndex++) {
      const stockingColor = STOCKING_COLORS[stockingIndex]!;
      const stockingX = fx + SCALE * 3 + stockingIndex * ST;
      // Stocking body
      fillRect(ctx, stockingX, fy - SCALE * 6, SCALE * 4, SCALE * 6, stockingColor);
      // White fur trim at top
      fillRect(ctx, stockingX, fy - SCALE * 8, SCALE * 4, SCALE * 2, C.white);
    }
  }

  /**
   * Draw 3 sleeping cots stacked vertically in the rest area.
   * Each cot has a wooden frame, red blanket, and cream pillow.
   * Located at COTS_POS (col 23, row 11), spaced 1.5 tiles apart.
   */
  drawCots(ctx: CanvasRenderingContext2D): void {
    const cotStartX = COTS_POS.col * ST;
    const cotStartY = COTS_POS.row * ST;

    for (let cotIndex = 0; cotIndex < 3; cotIndex++) {
      const cotY = cotStartY + cotIndex * ST * 1.5;
      // Wooden frame
      fillRect(ctx, cotStartX, cotY, ST * 3, ST, C.cot);
      // Red blanket covering most of the cot
      fillRect(ctx, cotStartX + SCALE, cotY + SCALE, ST * 3 - SCALE * 2, ST - SCALE * 2, C.cotBlanket);
      // Cream pillow at the right end
      fillRect(ctx, cotStartX + ST * 2.5, cotY + SCALE * 2, SCALE * 4, SCALE * 4, C.cotPillow);
    }
  }

  /**
   * Draw the notice board with pinned colored papers.
   * Located at NOTICE_BOARD_POS (col 23, row 3), 3 tiles wide, 2.5 tiles tall.
   * Papers are pinned with red pins at their top-center.
   */
  drawNoticeBoard(ctx: CanvasRenderingContext2D): void {
    const boardX = NOTICE_BOARD_POS.col * ST;
    const boardY = NOTICE_BOARD_POS.row * ST;

    // Cork board background
    fillRect(ctx, boardX, boardY, ST * 3, ST * 2.5, '#8B6914');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = SCALE;
    ctx.strokeRect(boardX, boardY, ST * 3, ST * 2.5);

    // Pinned papers — various colors and positions
    const papers = [
      { dx: SCALE * 3,  dy: SCALE * 3,  width: SCALE * 5, height: SCALE * 4, color: '#E8E0D0' },
      { dx: SCALE * 10, dy: SCALE * 2,  width: SCALE * 5, height: SCALE * 5, color: '#FFD93D' },
      { dx: SCALE * 5,  dy: SCALE * 9,  width: SCALE * 6, height: SCALE * 4, color: '#E0E8D0' },
      { dx: SCALE * 13, dy: SCALE * 9,  width: SCALE * 5, height: SCALE * 4, color: '#D0E0E8' },
    ];

    for (const paper of papers) {
      fillRect(ctx, boardX + paper.dx, boardY + paper.dy, paper.width, paper.height, paper.color);
      // Red pin at top-center of paper
      fillRect(
        ctx,
        boardX + paper.dx + paper.width / 2,
        boardY + paper.dy - SCALE,
        SCALE * 2,
        SCALE * 2,
        '#D04040',
      );
    }
  }

}
