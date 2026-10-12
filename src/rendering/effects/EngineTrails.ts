/**
 * EngineTrails — the fading exhaust ribbon behind every ship: one trail of
 * points per ship, aged each update and drawn as tapering segments.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";

/** Engine-glow colour per faction. */
const FACTION_ENGINE_COLORS: Record<FactionId, number> = {
  terran_hegemony: 0x00aaff,
  free_confederation: 0x44ff88,
  synthetic_collective: 0xff2200,
  void_corsairs: 0xff8800,
  ascendant_empire: 0x8844ff,
};

/** Trail points for a ship at speed 0; faster ships keep more. */
const BASE_TRAIL_POINTS = 15;
/** Extra trail points per unit of ship speed. */
const TRAIL_POINTS_PER_SPEED = 5;
/** Alpha lost per update at speed 0. */
const BASE_FADE_RATE = 0.03;
/** Extra alpha lost per update per unit of ship speed. */
const FADE_RATE_PER_SPEED = 0.01;
/** How far behind the ship centre the engine sits (px). */
const ENGINE_OFFSET_PX = 15;
/** Draw depth: below the ships. */
const TRAIL_DEPTH = 2;

interface TrailPoint {
  x: number;
  y: number;
  age: number;
  alpha: number;
}

interface EngineTrail {
  points: TrailPoint[];
  readonly color: number;
  readonly maxPoints: number;
  readonly fadeRate: number;
}

/** Owns the trail graphics and every ship's trail points. */
export class EngineTrails {
  private readonly trails = new Map<string, EngineTrail>();
  private readonly graphics: Phaser.GameObjects.Graphics;

  /** @param scene - Scene the trails are drawn in. */
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(TRAIL_DEPTH);
  }

  /**
   * Start a trail for a ship.
   *
   * @param shipId - Ship id.
   * @param faction - Its faction (trail colour).
   * @param speed - Its speed (longer, faster-fading trails when faster).
   */
  register(shipId: string, faction: FactionId, speed: number): void {
    this.trails.set(shipId, {
      points: [],
      color: FACTION_ENGINE_COLORS[faction],
      maxPoints: BASE_TRAIL_POINTS + speed * TRAIL_POINTS_PER_SPEED,
      fadeRate: BASE_FADE_RATE + speed * FADE_RATE_PER_SPEED,
    });
  }

  /**
   * Add the ship's current engine position and age the trail.
   *
   * @param shipId - Ship id.
   * @param x - Ship x.
   * @param y - Ship y.
   * @param angle - Heading in degrees (0 = up).
   */
  update(shipId: string, x: number, y: number, angle: number): void {
    const trail = this.trails.get(shipId);
    if (!trail) return;
    const angleRad = ((angle - 90) * Math.PI) / 180;
    trail.points.unshift({
      x: x - Math.cos(angleRad) * ENGINE_OFFSET_PX,
      y: y - Math.sin(angleRad) * ENGINE_OFFSET_PX,
      age: 0,
      alpha: 1,
    });
    trail.points = trail.points.filter((point, index) => {
      point.age++;
      point.alpha = Math.max(0, 1 - point.age * trail.fadeRate);
      return point.alpha > 0 && index < trail.maxPoints;
    });
  }

  /** @param shipId - Ship whose trail ends (destroyed). */
  remove(shipId: string): void {
    this.trails.delete(shipId);
  }

  /** Drop every trail (quality setting turned trails off). */
  clear(): void {
    this.trails.clear();
  }

  /** Redraw every trail. */
  render(): void {
    this.graphics.clear();
    for (const trail of this.trails.values()) {
      if (trail.points.length < 2) continue;
      this.drawSegments(trail);
      this.drawCore(trail.points[0]!, trail.color);
    }
  }

  /** Destroy the graphics and forget every trail. */
  destroy(): void {
    this.trails.clear();
    this.graphics.destroy();
  }

  private drawSegments(trail: EngineTrail): void {
    for (let i = 1; i < trail.points.length; i++) {
      const p1 = trail.points[i - 1]!;
      const p2 = trail.points[i]!;
      const alpha = (p1.alpha + p2.alpha) / 2;
      this.graphics.lineStyle(Math.max(1, 4 * alpha), trail.color, alpha * 0.6);
      this.graphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
    }
  }

  private drawCore(point: TrailPoint, color: number): void {
    this.graphics.fillStyle(0xffffff, 0.8);
    this.graphics.fillCircle(point.x, point.y, 2);
    this.graphics.fillStyle(color, 0.5);
    this.graphics.fillCircle(point.x, point.y, 4);
  }
}
