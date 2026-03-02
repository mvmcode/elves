/* ElfPalette — color palette system for elf visual diversity.
 * Inspired by pixel-agents' palette diversity system. Each elf gets a unique
 * combination of skin, body, hat, apron, and boot colors so agents are
 * visually distinguishable at a glance. */

/** Full color palette for an elf character. */
export interface ElfColorPalette {
  readonly skin: string;
  readonly body: string;
  readonly hat: string;
  readonly apron: string;
  readonly boots: string;
}

/**
 * Six base palettes — designed to be visually distinct while maintaining
 * the elf workshop aesthetic. Colors are warm, saturated, and high-contrast.
 */
const BASE_PALETTES: readonly ElfColorPalette[] = [
  { skin: '#FFCC99', body: '#D04040', hat: '#D04040', apron: '#4D96FF', boots: '#5A3A2A' },
  { skin: '#FFCC99', body: '#40A040', hat: '#40A040', apron: '#4D96FF', boots: '#3A2A1A' },
  { skin: '#DEB887', body: '#4D96FF', hat: '#4D96FF', apron: '#FFD93D', boots: '#5A3A2A' },
  { skin: '#FFCC99', body: '#9B59B6', hat: '#9B59B6', apron: '#4D96FF', boots: '#3A2A1A' },
  { skin: '#DEB887', body: '#FF8B3D', hat: '#FF8B3D', apron: '#4D96FF', boots: '#5A3A2A' },
  { skin: '#FFCC99', body: '#1A8A8A', hat: '#1A8A8A', apron: '#FFD93D', boots: '#3A2A1A' },
] as const;

/**
 * Pick a diverse palette for a new elf based on what's already in use.
 * Selects the least-used palette index, preferring lower indices on ties.
 *
 * @param usedPaletteIndices - Array of palette indices already assigned to active elves
 * @returns The chosen palette and its index
 */
export function pickDiversePalette(
  usedPaletteIndices: readonly number[],
): { palette: ElfColorPalette; index: number } {
  /* Count how many times each palette is used */
  const counts = new Array<number>(BASE_PALETTES.length).fill(0);
  for (const idx of usedPaletteIndices) {
    if (idx >= 0 && idx < counts.length) {
      counts[idx]!++;
    }
  }

  /* Find the minimum count and pick the first palette with that count */
  let minCount = Infinity;
  let bestIndex = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i]! < minCount) {
      minCount = counts[i]!;
      bestIndex = i;
    }
  }

  return {
    palette: BASE_PALETTES[bestIndex]!,
    index: bestIndex,
  };
}

/**
 * Get a palette by index, wrapping around if index exceeds available palettes.
 */
export function getPalette(index: number): ElfColorPalette {
  return BASE_PALETTES[index % BASE_PALETTES.length]!;
}

/** Total number of available palettes. */
export const PALETTE_COUNT = BASE_PALETTES.length;
