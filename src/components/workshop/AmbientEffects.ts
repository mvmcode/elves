/* AmbientEffects — event-triggered lighting overlays for the workshop scene.
   Manages red error flashes, green test-pass pulses, session-complete fireworks,
   and the default warm glow. Stateful: owns flicker timers and firework entries. */

import type { LightFlickerState } from '../../types/workshop';

/** Duration in frames for the red error flicker (1 second at 60fps) */
const RED_FLICKER_DURATION = 60;

/** Duration in frames for the green test-pass flicker (0.5 seconds at 60fps) */
const GREEN_FLICKER_DURATION = 30;

/** Overlay color when in normal (warm glow) state */
const WARM_GLOW_COLOR = 'rgba(255,200,80,0.06)';

/** A single firework burst entry with position and countdown timer */
interface FireworkEntry {
  readonly x: number;
  readonly y: number;
  timer: number;
}

/**
 * Manages event-triggered lighting overlays for the workshop scene.
 * Call triggerRedFlicker/triggerGreenFlicker/triggerFireworks in response to
 * agent events, then query getOverlayColor each frame for the current tint.
 */
export class AmbientEffects {
  private flickerState: LightFlickerState = {
    color: 'normal',
    timer: 0,
    duration: 0,
  };

  private fireworkEntries: FireworkEntry[] = [];

  /**
   * Trigger a red overlay flash in response to an error event.
   * The flash lasts RED_FLICKER_DURATION frames (1 second) and fades linearly.
   */
  triggerRedFlicker(): void {
    this.flickerState = {
      color: 'red',
      timer: RED_FLICKER_DURATION,
      duration: RED_FLICKER_DURATION,
    };
  }

  /**
   * Trigger a green overlay flash in response to a successful test pass.
   * The flash lasts GREEN_FLICKER_DURATION frames (0.5 seconds) and fades linearly.
   */
  triggerGreenFlicker(): void {
    this.flickerState = {
      color: 'green',
      timer: GREEN_FLICKER_DURATION,
      duration: GREEN_FLICKER_DURATION,
    };
  }

  /**
   * Register a firework burst at the given canvas coordinates.
   * Called on session-complete events. The burst lasts 45 frames.
   */
  triggerFireworks(x: number, y: number): void {
    this.fireworkEntries.push({ x, y, timer: 45 });
  }

  /**
   * Return the current overlay color string for the full-scene tint.
   * Blends between warm glow (normal), red flash, and green flash
   * based on the active flicker state and remaining timer.
   *
   * @param _time - animation frame time (unused; reserved for future wave effects)
   * @returns CSS rgba color string for the overlay fill
   */
  getOverlayColor(_time: number): string {
    if (this.flickerState.color === 'normal' || this.flickerState.duration === 0) {
      return WARM_GLOW_COLOR;
    }

    // Fade intensity linearly from 1 (start) to 0 (expired)
    const intensity = this.flickerState.timer / this.flickerState.duration;

    if (this.flickerState.color === 'red') {
      // Interpolate between warm glow and red flash based on intensity
      const red = Math.floor(255 * intensity + 255 * (1 - intensity));
      const green = Math.floor(60 * intensity + 200 * (1 - intensity));
      const blue = Math.floor(40 * intensity + 80 * (1 - intensity));
      const alpha = 0.06 + 0.06 * intensity;
      return `rgba(${red},${green},${blue},${alpha.toFixed(3)})`;
    }

    // Green flicker
    const red = Math.floor(60 * intensity + 255 * (1 - intensity));
    const green = Math.floor(200 * intensity + 200 * (1 - intensity));
    const blue = Math.floor(80 * intensity + 80 * (1 - intensity));
    const alpha = 0.06 + 0.02 * intensity;
    return `rgba(${red},${green},${blue},${alpha.toFixed(3)})`;
  }

  /**
   * Advance all flicker and firework timers by the given frame delta.
   * Call once per animation frame. Expired fireworks are removed,
   * expired flickers revert to normal state.
   *
   * @param dt - number of frames elapsed (typically 1)
   */
  update(dt: number): void {
    // Advance flicker timer
    if (this.flickerState.timer > 0) {
      const newTimer = this.flickerState.timer - dt;
      if (newTimer <= 0) {
        this.flickerState = { color: 'normal', timer: 0, duration: 0 };
      } else {
        // LightFlickerState has readonly fields, so reconstruct
        this.flickerState = {
          color: this.flickerState.color,
          timer: newTimer,
          duration: this.flickerState.duration,
        };
      }
    }

    // Advance firework timers and remove expired entries
    for (const entry of this.fireworkEntries) {
      entry.timer -= dt;
    }
    this.fireworkEntries = this.fireworkEntries.filter(
      (entry: FireworkEntry) => entry.timer > 0,
    );
  }

  /**
   * Check whether the lighting is currently in a non-normal flicker state
   * (red or green flash active with remaining timer).
   */
  isFlickering(): boolean {
    return this.flickerState.color !== 'normal' && this.flickerState.timer > 0;
  }

  /**
   * Get a read-only snapshot of active firework entries for external rendering.
   * Each entry has x, y canvas coordinates and a remaining timer.
   */
  getFireworks(): readonly FireworkEntry[] {
    return this.fireworkEntries;
  }
}
