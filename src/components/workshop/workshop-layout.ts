/* Workshop layout constants — defines the tile grid, color palette, workbench positions,
   walkability map, and key landmark coordinates for the pixel-art workshop scene. */

import type { WorkbenchConfig, WorkbenchTheme } from '../../types/workshop';

// ---- Grid Constants ----

/** Base tile size in pixels before scaling */
export const TILE = 16;

/** Scale factor applied to all pixel-art rendering */
export const SCALE = 3;

/** Scaled tile size: TILE * SCALE = 48px per tile on screen */
export const ST = TILE * SCALE;

/** Number of tile columns in the workshop grid */
export const COLS = 28;

/** Number of tile rows in the workshop grid */
export const ROWS = 18;

/** Canvas width in pixels: COLS * ST */
export const CANVAS_WIDTH = COLS * ST;

/** Canvas height in pixels: ROWS * ST */
export const CANVAS_HEIGHT = ROWS * ST;

// ---- Color Palette ----

/** Workshop color palette — every color used in the pixel-art scene.
 *  Named semantically by what they represent, not by hue. */
export const C = {
  floorWood:   '#8B6914',
  floorWood2:  '#9B7924',
  floorWood3:  '#7B5904',
  wallLog:     '#5B3216',
  wallLog2:    '#6B4226',
  wallTrim:    '#C8A050',
  bench:       '#A67C2E',
  benchDark:   '#7A5C1E',
  benchTop:    '#C89840',
  snow:        '#E8E8F0',
  snowDark:    '#C8C8D8',
  sky:         '#1A1A3E',
  skyLight:    '#2A2A5E',
  fireOrange:  '#FF8040',
  fireYellow:  '#FFD040',
  fireRed:     '#FF4020',
  carpet:      '#802020',
  carpetLight: '#A03030',
  green:       '#40A040',
  greenDark:   '#308030',
  gold:        '#FFD93D',
  white:       '#F0F0E0',
  black:       '#000',
  warmGlow:    'rgba(255,200,80,0.06)',
  conveyorA:   '#606060',
  conveyorB:   '#707070',
  conveyorC:   '#505050',
  windowBlue:  '#4060A0',
  windowLight: '#6080C0',
  cot:         '#6B5040',
  cotBlanket:  '#B03030',
  cotPillow:   '#E0D0C0',
} as const;

export type WorkshopColor = typeof C;

// ---- Workbench Definitions ----

/** All 6 workbenches positioned to match the mockup layout.
 *  Top row: y=4 (Mechanical, Research, Code, Testing)
 *  Bottom row: y=11 (Architecture, Writing) */
export const WORKBENCHES: readonly WorkbenchConfig[] = [
  { id: 0, x: 3,  y: 4,  name: 'Mechanical',  theme: 0 as WorkbenchTheme, assignedElfId: null },
  { id: 1, x: 8,  y: 4,  name: 'Research',     theme: 1 as WorkbenchTheme, assignedElfId: null },
  { id: 2, x: 13, y: 4,  name: 'Code',         theme: 2 as WorkbenchTheme, assignedElfId: null },
  { id: 3, x: 18, y: 4,  name: 'Testing',      theme: 3 as WorkbenchTheme, assignedElfId: null },
  { id: 4, x: 3,  y: 11, name: 'Architecture', theme: 4 as WorkbenchTheme, assignedElfId: null },
  { id: 5, x: 8,  y: 11, name: 'Writing',      theme: 5 as WorkbenchTheme, assignedElfId: null },
] as const;

// ---- Key Position Constants ----

/** Door position in the bottom wall (2-tile wide entrance) */
export const DOOR_POS = { col: 13, row: ROWS - 1 } as const;

/** Notice board position on the right side of the workshop */
export const NOTICE_BOARD_POS = { col: 23, row: 3 } as const;

/** Cookie jar position just below the conveyor belt */
export const COOKIE_JAR_POS = { col: 18, row: 9 } as const;

/** Fireplace position in the lower-right area */
export const FIREPLACE_POS = { col: 21, row: 13 } as const;

/** Sleeping cots position in the far-right area */
export const COTS_POS = { col: 23, row: 11 } as const;

/** Delivery chute position on the left wall */
export const DELIVERY_CHUTE_POS = { col: 1, row: 8 } as const;

/** Wall clock position on the top wall */
export const CLOCK_POS = { col: 12, row: 2 } as const;

/** Window column positions along the top wall */
export const WINDOW_COLS = [4, 9, 14, 19, 24] as const;

/** Tree silhouette column positions in the sky backdrop */
export const TREE_COLS = [2, 5, 7, 20, 23, 25] as const;

/** Star positions for twinkling sky effect [x, y] in unscaled coords */
export const STAR_POSITIONS: readonly [number, number][] = [
  [50, 10], [150, 20], [300, 8], [450, 25], [600, 15],
  [750, 5], [820, 22], [100, 30], [400, 12], [650, 28],
] as const;

/** Colors for the hanging light bulbs along the top wall */
export const BULB_COLORS = ['#FF4040', '#40FF40', '#4040FF', '#FFD93D', '#FF40FF'] as const;

/** Colors for stocking decorations on the fireplace mantle */
export const STOCKING_COLORS = ['#D04040', '#40A040', '#4D96FF'] as const;

// ---- Walkable Grid ----

/** Generates the walkability grid: true = elf can walk there, false = blocked.
 *  Blocked tiles: sky (rows 0-1), walls (row 2, row 17, col 0, col 27),
 *  conveyor belt (row 8), workbenches, fireplace, cots, notice board. */
export function buildWalkableGrid(): boolean[][] {
  const grid: boolean[][] = [];

  for (let row = 0; row < ROWS; row++) {
    const gridRow: boolean[] = [];
    grid[row] = gridRow;
    for (let col = 0; col < COLS; col++) {
      if (row < 2) {
        // Sky/outside — not walkable
        gridRow[col] = false;
      } else if (row === 2) {
        // Top wall
        gridRow[col] = false;
      } else if (row === ROWS - 1) {
        // Bottom wall (except door)
        gridRow[col] = (col === DOOR_POS.col || col === DOOR_POS.col + 1);
      } else if (col === 0 || col === COLS - 1) {
        // Side walls
        gridRow[col] = false;
      } else if (row === 8) {
        // Conveyor belt row
        gridRow[col] = false;
      } else {
        // Default: floor is walkable
        gridRow[col] = true;
      }
    }
  }

  // Block workbench tiles (each bench is 3 tiles wide, 2 tiles tall)
  for (const bench of WORKBENCHES) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const row = bench.y + dy;
        const col = bench.x + dx;
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
          grid[row]![col] = false;
        }
      }
    }
  }

  // Block fireplace tiles (3 wide, 2 tall)
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const row = FIREPLACE_POS.row + dy;
      const col = FIREPLACE_POS.col + dx;
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        grid[row]![col] = false;
      }
    }
  }

  // Block cot tiles (3 wide, 5 tall for all 3 cots stacked vertically)
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const row = COTS_POS.row + dy;
      const col = COTS_POS.col + dx;
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        grid[row]![col] = false;
      }
    }
  }

  // Block notice board tiles (3 wide, 3 tall)
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const row = NOTICE_BOARD_POS.row + dy;
      const col = NOTICE_BOARD_POS.col + dx;
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        grid[row]![col] = false;
      }
    }
  }

  // Block carpet area near fireplace (walkable over, but visually different — keep walkable)
  // Carpet at rows 13-15, cols 15-19 is walkable (elves can walk on carpet)

  return grid;
}

/** Pre-built walkable grid for runtime use */
export const WALKABLE_GRID: boolean[][] = buildWalkableGrid();
