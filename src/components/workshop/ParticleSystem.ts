/* Particle system for the workshop scene — snow, sparkles, smoke, ZZZ, and celebration effects. */

import type { ParticleConfig, ParticleType } from "../../types/workshop";
import { SCALE } from "./workshop-layout";

/** Pre-defined burst colors for celebration particles. */
const CELEBRATE_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF8B3D", "#9B59B6"];

/** Pixel font placeholder for rendering "z" characters. */
const ZZZ_FONT = `${SCALE * 3}px 'Press Start 2P', monospace`;

/**
 * Manages all particle effects in the workshop scene.
 *
 * Each particle has a type that determines its update and draw behavior.
 * Particles are automatically removed when their life exceeds maxLife.
 */
export class ParticleSystem {
  particles: ParticleConfig[] = [];

  /** Add a single particle to the system. */
  add(particle: ParticleConfig): void {
    this.particles.push(particle);
  }

  /**
   * Spawn a burst of particles at a position.
   * Behavior varies by type:
   * - sparkle: radial burst with gravity, multicolor
   * - celebrate: wide radial burst, bright colors, higher velocity
   * - smoke: upward drift cluster, gray
   * - zzz: slow upward floaters
   * - snow: horizontal spread, gentle downward drift
   */
  addBurst(x: number, y: number, type: ParticleType, count: number): void {
    for (let i = 0; i < count; i++) {
      this.add(this.createBurstParticle(x, y, type));
    }
  }

  /** Update all particles: apply physics, age, and cull dead particles. */
  update(dt: number, time: number): void {
    // Normalize dt to ~16ms frames for consistent physics
    const frameDt = Math.min(dt, 32) / 16;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]!;
      particle.life += frameDt;

      if (particle.life >= particle.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      this.updateParticle(particle, frameDt, time);
    }
  }

  /** Draw all active particles to the canvas. */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      const alpha = this.getAlpha(particle);
      if (alpha <= 0) continue;

      ctx.globalAlpha = alpha;
      this.drawParticle(ctx, particle);
    }
    ctx.globalAlpha = 1;
  }

  /** Return current particle count (useful for diagnostics). */
  get count(): number {
    return this.particles.length;
  }

  /** Remove all particles. */
  clear(): void {
    this.particles.length = 0;
  }

  private updateParticle(particle: ParticleConfig, frameDt: number, time: number): void {
    switch (particle.type) {
      case "snow":
        this.updateSnow(particle, frameDt, time);
        break;
      case "sparkle":
        this.updateSparkle(particle, frameDt);
        break;
      case "smoke":
        this.updateSmoke(particle, frameDt);
        break;
      case "zzz":
        this.updateZzz(particle, frameDt, time);
        break;
      case "celebrate":
        this.updateCelebrate(particle, frameDt);
        break;
    }
  }

  private updateSnow(particle: ParticleConfig, frameDt: number, time: number): void {
    particle.y += particle.vy * frameDt;
    particle.x += particle.vx + Math.sin(time * 0.001 + particle.x * 0.01) * 0.2;
  }

  private updateSparkle(particle: ParticleConfig, frameDt: number): void {
    particle.x += particle.vx * frameDt;
    particle.y += particle.vy * frameDt;
    particle.vy += 0.05 * frameDt; // gravity
  }

  private updateSmoke(particle: ParticleConfig, frameDt: number): void {
    particle.x += particle.vx * frameDt;
    particle.y += particle.vy * frameDt;
    particle.vy *= 0.98; // decelerate upward
  }

  private updateZzz(particle: ParticleConfig, frameDt: number, _time: number): void {
    particle.y -= 0.3 * frameDt;
    particle.x += Math.sin(particle.life * 0.05) * 0.3;
  }

  private updateCelebrate(particle: ParticleConfig, frameDt: number): void {
    particle.x += particle.vx * frameDt;
    particle.y += particle.vy * frameDt;
    particle.vy += 0.08 * frameDt; // gravity
    particle.vx *= 0.99; // air resistance
  }

  private drawParticle(ctx: CanvasRenderingContext2D, particle: ParticleConfig): void {
    switch (particle.type) {
      case "snow":
        this.drawSnowParticle(ctx, particle);
        break;
      case "sparkle":
        this.drawSparkleParticle(ctx, particle);
        break;
      case "smoke":
        this.drawSmokeParticle(ctx, particle);
        break;
      case "zzz":
        this.drawZzzParticle(ctx, particle);
        break;
      case "celebrate":
        this.drawCelebrateParticle(ctx, particle);
        break;
    }
  }

  private drawSnowParticle(ctx: CanvasRenderingContext2D, particle: ParticleConfig): void {
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      Math.floor(particle.x),
      Math.floor(particle.y),
      particle.size,
      particle.size,
    );
  }

  private drawSparkleParticle(ctx: CanvasRenderingContext2D, particle: ParticleConfig): void {
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      Math.floor(particle.x),
      Math.floor(particle.y),
      SCALE,
      SCALE,
    );
  }

  private drawSmokeParticle(ctx: CanvasRenderingContext2D, particle: ParticleConfig): void {
    const progress = particle.life / particle.maxLife;
    const expansionSize = particle.size + progress * SCALE * 2;
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      Math.floor(particle.x - expansionSize / 2),
      Math.floor(particle.y),
      expansionSize,
      expansionSize,
    );
  }

  private drawZzzParticle(ctx: CanvasRenderingContext2D, particle: ParticleConfig): void {
    ctx.font = ZZZ_FONT;
    ctx.textAlign = "center";
    ctx.fillStyle = particle.color;
    ctx.fillText("z", particle.x, particle.y);
  }

  private drawCelebrateParticle(ctx: CanvasRenderingContext2D, particle: ParticleConfig): void {
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      Math.floor(particle.x),
      Math.floor(particle.y),
      particle.size,
      particle.size,
    );
  }

  /** Calculate alpha based on particle life. Fade out in the last 30% of lifetime. */
  private getAlpha(particle: ParticleConfig): number {
    const progress = particle.life / particle.maxLife;
    if (particle.type === "snow") {
      return 0.6 * (1 - progress * 0.3);
    }
    if (progress > 0.7) {
      return 1 - (progress - 0.7) / 0.3;
    }
    return 1;
  }

  private createBurstParticle(x: number, y: number, type: ParticleType): ParticleConfig {
    switch (type) {
      case "sparkle":
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * 2,
          vy: -1 - Math.random() * 2,
          life: 0,
          maxLife: 30,
          color: Math.random() > 0.5 ? "#40FF40" : "#FFD93D",
          type: "sparkle",
          size: SCALE,
        };

      case "celebrate":
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: -2 - Math.random() * 4,
          life: 0,
          maxLife: 50,
          color: CELEBRATE_COLORS[Math.floor(Math.random() * CELEBRATE_COLORS.length)] ?? "#FFD93D",
          type: "celebrate",
          size: SCALE + Math.floor(Math.random() * SCALE),
        };

      case "smoke":
        return {
          x: x + (Math.random() - 0.5) * SCALE * 4,
          y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.5 - Math.random() * 1,
          life: 0,
          maxLife: 20,
          color: "#808080",
          type: "smoke",
          size: SCALE,
        };

      case "zzz":
        return {
          x: x + (Math.random() - 0.5) * SCALE * 4,
          y,
          vx: 0,
          vy: -0.3,
          life: 0,
          maxLife: 120,
          color: "#FFFDF7",
          type: "zzz",
          size: SCALE * 3,
        };

      case "snow":
        return {
          x: x + (Math.random() - 0.5) * SCALE * 20,
          y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 0.2 + Math.random() * 0.5,
          life: 0,
          maxLife: 200,
          color: "#F0F0E0",
          type: "snow",
          size: 1 + Math.random() * 2,
        };
    }
  }
}
