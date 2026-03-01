/* A* pathfinder for the workshop tile grid — routes elves between workbenches, the door, and points of interest. */

import type { TilePos, Vec2 } from "../../types/workshop";
import { ST } from "./workshop-layout";

/** Priority queue node for A* open set. */
interface PathNode {
  readonly col: number;
  readonly row: number;
  readonly g: number;
  readonly f: number;
  readonly parent: PathNode | null;
}

/**
 * Grid-based A* pathfinder with Manhattan heuristic.
 *
 * Operates on a boolean walkability grid where `true` = walkable.
 * Supports temporary blocks for dynamic obstacles (elves occupying tiles).
 */
export class Pathfinder {
  private readonly grid: boolean[][];
  private readonly rows: number;
  private readonly cols: number;
  private readonly tempBlocks: Set<string> = new Set();

  constructor(walkableGrid: boolean[][]) {
    this.grid = walkableGrid;
    this.rows = walkableGrid.length;
    const firstRow = walkableGrid[0];
    this.cols = firstRow !== undefined ? firstRow.length : 0;
  }

  /**
   * Find the shortest path from `from` to `to` using A* with Manhattan heuristic.
   * Returns the path as an array of tile positions, excluding the start tile.
   * Returns an empty array if no path exists.
   */
  findPath(from: TilePos, to: TilePos): TilePos[] {
    if (!this.isWalkable(to.col, to.row)) {
      return [];
    }

    const key = (col: number, row: number): string => `${col},${row}`;
    const closed = new Set<string>();
    const openMap = new Map<string, PathNode>();

    const startNode: PathNode = {
      col: from.col,
      row: from.row,
      g: 0,
      f: this.manhattan(from.col, from.row, to.col, to.row),
      parent: null,
    };

    const open: PathNode[] = [startNode];
    openMap.set(key(from.col, from.row), startNode);

    const directions = [
      { dc: 0, dr: -1 },
      { dc: 0, dr: 1 },
      { dc: -1, dr: 0 },
      { dc: 1, dr: 0 },
    ];

    while (open.length > 0) {
      // Find node with lowest f score (simple linear scan — grid is small enough)
      let bestIndex = 0;
      for (let i = 1; i < open.length; i++) {
        const candidate = open[i];
        const best = open[bestIndex];
        if (candidate !== undefined && best !== undefined && candidate.f < best.f) {
          bestIndex = i;
        }
      }

      const current = open.splice(bestIndex, 1)[0];
      if (current === undefined) break;

      const currentKey = key(current.col, current.row);
      openMap.delete(currentKey);

      if (current.col === to.col && current.row === to.row) {
        return this.reconstructPath(current);
      }

      closed.add(currentKey);

      for (const dir of directions) {
        const neighborCol = current.col + dir.dc;
        const neighborRow = current.row + dir.dr;
        const neighborKey = key(neighborCol, neighborRow);

        if (closed.has(neighborKey)) continue;
        if (!this.isWalkable(neighborCol, neighborRow)) continue;

        const tentativeG = current.g + 1;
        const existing = openMap.get(neighborKey);

        if (existing && tentativeG >= existing.g) continue;

        const neighborNode: PathNode = {
          col: neighborCol,
          row: neighborRow,
          g: tentativeG,
          f: tentativeG + this.manhattan(neighborCol, neighborRow, to.col, to.row),
          parent: current,
        };

        if (existing) {
          const idx = open.indexOf(existing);
          if (idx !== -1) open.splice(idx, 1);
        }

        open.push(neighborNode);
        openMap.set(neighborKey, neighborNode);
      }
    }

    return [];
  }

  /** Convert tile coordinates to pixel-space center point. */
  tileToPixel(tile: TilePos): Vec2 {
    return {
      x: tile.col * ST + ST / 2,
      y: tile.row * ST + ST / 2,
    };
  }

  /** Convert pixel coordinates to the containing tile. */
  pixelToTile(pos: Vec2): TilePos {
    return {
      col: Math.floor(pos.x / ST),
      row: Math.floor(pos.y / ST),
    };
  }

  /** Check if a tile is within bounds and walkable (respects temporary blocks). */
  isWalkable(col: number, row: number): boolean {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return false;
    }
    if (this.tempBlocks.has(`${col},${row}`)) {
      return false;
    }
    const gridRow = this.grid[row];
    if (gridRow === undefined) return false;
    return gridRow[col] ?? false;
  }

  /** Set or clear a temporary block on a tile (for dynamic obstacles like other elves). */
  setTemporaryBlock(col: number, row: number, blocked: boolean): void {
    const blockKey = `${col},${row}`;
    if (blocked) {
      this.tempBlocks.add(blockKey);
    } else {
      this.tempBlocks.delete(blockKey);
    }
  }

  /** Clear all temporary blocks. */
  clearTemporaryBlocks(): void {
    this.tempBlocks.clear();
  }

  /**
   * Find the nearest walkable tile to a given position by expanding search radius.
   * Returns the target itself if walkable, otherwise spirals outward up to radius 8.
   * Returns null if no walkable tile is found within range.
   */
  findNearestWalkable(target: TilePos): TilePos | null {
    if (this.isWalkable(target.col, target.row)) return target;

    for (let radius = 1; radius <= 8; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          // Only check tiles on the perimeter of the current radius
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const col = target.col + dc;
          const row = target.row + dr;
          if (this.isWalkable(col, row)) {
            return { col, row };
          }
        }
      }
    }

    return null;
  }

  private manhattan(c1: number, r1: number, c2: number, r2: number): number {
    return Math.abs(c1 - c2) + Math.abs(r1 - r2);
  }

  /** Walk the parent chain from goal back to start, return path excluding the start node. */
  private reconstructPath(goalNode: PathNode): TilePos[] {
    const path: TilePos[] = [];
    let current: PathNode | null = goalNode;

    while (current !== null) {
      path.push({ col: current.col, row: current.row });
      current = current.parent;
    }

    path.reverse();
    // Exclude the start position
    return path.slice(1);
  }
}
