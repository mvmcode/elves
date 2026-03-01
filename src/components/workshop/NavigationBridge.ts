/* NavigationBridge — connects the A* pathfinder to elf sprite walking by converting between pixel and tile coordinates. */

import type { Vec2 } from '../../types/workshop';
import type { Pathfinder } from './Pathfinder';
import type { ElfSprite } from './ElfSprite';

/**
 * Compute a pixel-space path for an elf from one position to another.
 * Converts pixel positions to tile coordinates, runs A* pathfinding,
 * and converts the resulting tile path back to pixel waypoints.
 * Returns an empty array if no path exists.
 */
export function computeElfPath(pathfinder: Pathfinder, from: Vec2, to: Vec2): Vec2[] {
  const fromTile = pathfinder.pixelToTile(from);
  const toTile = pathfinder.pixelToTile(to);

  const tilePath = pathfinder.findPath(fromTile, toTile);

  return tilePath.map((tile) => pathfinder.tileToPixel(tile));
}

/**
 * Update dynamic obstacle blocks so elves avoid walking through each other.
 * Clears all existing temporary blocks, then sets a block at each elf's current tile.
 * Should be called before pathfinding to reflect current elf positions.
 */
export function updateDynamicBlocks(pathfinder: Pathfinder, elves: ElfSprite[]): void {
  pathfinder.clearTemporaryBlocks();

  for (const elf of elves) {
    const position = elf.getPosition();
    const tile = pathfinder.pixelToTile(position);
    pathfinder.setTemporaryBlock(tile.col, tile.row, true);
  }
}

/**
 * Find the nearest walkable tile to a target pixel position.
 * If the target tile is blocked, uses the pathfinder's spiral search to find
 * the closest walkable tile, then returns its pixel-space center.
 * Returns null if no walkable tile is found within search radius.
 */
export function findNearestWalkableTile(pathfinder: Pathfinder, target: Vec2): Vec2 | null {
  const targetTile = pathfinder.pixelToTile(target);
  const walkableTile = pathfinder.findNearestWalkable(targetTile);

  if (walkableTile === null) return null;

  return pathfinder.tileToPixel(walkableTile);
}
