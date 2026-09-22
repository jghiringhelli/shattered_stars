/**
 * Effects Manager
 *
 * Handles visual effects:
 * - Engine trails
 * - Weapon projectiles
 * - Shield impacts
 * - Explosions
 * - Screen shake
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import { FACTION_COLORS } from "../config";
import { audioManager } from "../audio/AudioManager";
import type { EffectSettings } from "../systems/PerformanceSystem";

// Faction-specific effect colors
const FACTION_LASER_COLORS: Record<FactionId, number> = {
  terran_hegemony: 0x00aaff,
  free_confederation: 0x44ff88,
  synthetic_collective: 0xff4444,
  void_corsairs: 0xffaa00,
  ascendant_empire: 0xaa44ff,
};

const FACTION_ENGINE_COLORS: Record<FactionId, number> = {
  terran_hegemony: 0x00aaff,
  free_confederation: 0x44ff88,
  synthetic_collective: 0xff2200,
  void_corsairs: 0xff8800,
  ascendant_empire: 0x8844ff,
};

interface TrailPoint {
  x: number;
  y: number;
  age: number;
  alpha: number;
}

interface EngineTrail {
  shipId: string;
  points: TrailPoint[];
  color: number;
  maxPoints: number;
  fadeRate: number;
}

export class EffectsManager {
  private scene: Phaser.Scene;
  private engineTrails: Map<string, EngineTrail> = new Map();
  private trailGraphics: Phaser.GameObjects.Graphics;
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private engineTrailsEnabled = true;
  private damageNumbersEnabled = true;
  private cameraShakeEnabled = true;
  private particleMultiplier = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.trailGraphics = scene.add.graphics();
    this.trailGraphics.setDepth(2); // Below ships
  }

  /**
   * Apply adaptive quality settings from PerformanceSystem.
   * @param settings - Current effect settings from PerformanceSystem.evaluateQuality()
   */
  setQualitySettings(settings: EffectSettings): void {
    this.engineTrailsEnabled = settings.engineTrails;
    this.particleMultiplier = settings.particleCount;
    this.cameraShakeEnabled = settings.screenShake;
    this.damageNumbersEnabled = settings.damageIndicators;
    if (!settings.engineTrails) {
      this.engineTrails.clear();
    }
  }

  /**
   * Apply user preferences from SettingsScene.
   * @param settings - User preferences (cameraShake, showDamageNumbers)
   */
  setUserSettings(settings: {
    showDamageNumbers: boolean;
    cameraShake: boolean;
  }): void {
    this.damageNumbersEnabled = settings.showDamageNumbers;
    this.cameraShakeEnabled = settings.cameraShake;
  }

  // ==========================================
  // ENGINE TRAILS
  // ==========================================

  /**
   * Register a ship for engine trail rendering
   */
  registerEngineTrail(
    shipId: string,
    faction: FactionId,
    speed: number = 2,
  ): void {
    if (!this.engineTrailsEnabled) return;
    const maxPoints = 15 + speed * 5; // Longer trails for faster ships

    this.engineTrails.set(shipId, {
      shipId,
      points: [],
      color: FACTION_ENGINE_COLORS[faction],
      maxPoints,
      fadeRate: 0.03 + speed * 0.01,
    });
  }

  /**
   * Update engine trail position
   */
  updateTrailPosition(
    shipId: string,
    x: number,
    y: number,
    angle: number,
  ): void {
    const trail = this.engineTrails.get(shipId);
    if (!trail) return;

    // Calculate engine position (behind the ship)
    const angleRad = ((angle - 90) * Math.PI) / 180;
    const offsetDistance = 15; // Distance behind ship center
    const engineX = x - Math.cos(angleRad) * offsetDistance;
    const engineY = y - Math.sin(angleRad) * offsetDistance;

    // Add new point
    trail.points.unshift({
      x: engineX,
      y: engineY,
      age: 0,
      alpha: 1,
    });

    // Age existing points and remove old ones
    trail.points = trail.points.filter((point, index) => {
      point.age++;
      point.alpha = Math.max(0, 1 - point.age * trail.fadeRate);
      return point.alpha > 0 && index < trail.maxPoints;
    });
  }

  /**
   * Remove engine trail when ship is destroyed
   */
  removeEngineTrail(shipId: string): void {
    this.engineTrails.delete(shipId);
  }

  /**
   * Render all engine trails
   */
  renderTrails(): void {
    this.trailGraphics.clear();

    for (const trail of this.engineTrails.values()) {
      if (trail.points.length < 2) continue;

      // Draw trail as connected line segments with fading alpha
      for (let i = 1; i < trail.points.length; i++) {
        const p1 = trail.points[i - 1]!;
        const p2 = trail.points[i]!;

        const alpha = (p1.alpha + p2.alpha) / 2;
        const width = Math.max(1, 4 * alpha);

        this.trailGraphics.lineStyle(width, trail.color, alpha * 0.6);
        this.trailGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
      }

      // Draw glowing core at the start
      if (trail.points[0]) {
        const p = trail.points[0];
        this.trailGraphics.fillStyle(0xffffff, 0.8);
        this.trailGraphics.fillCircle(p.x, p.y, 2);
        this.trailGraphics.fillStyle(trail.color, 0.5);
        this.trailGraphics.fillCircle(p.x, p.y, 4);
      }
    }
  }

  // ==========================================
  // WEAPON EFFECTS
  // ==========================================

  /**
   * Create laser bolt effect
   */
  fireLaser(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    faction: FactionId,
    hit: boolean,
  ): void {
    // Fired from the shooter's position, so a distant exchange sits back in
    // the mix instead of on top of the player's own guns.
    audioManager.playSoundAt("laser_fire", fromX, fromY, hit ? 0.8 : 0.5);

    const color = FACTION_LASER_COLORS[faction];
    const graphics = this.scene.add.graphics();
    graphics.setDepth(15);

    // Calculate offset for misses
    const missOffset = hit ? 0 : (Math.random() - 0.5) * 40;
    const targetX = toX + missOffset;
    const targetY = toY + missOffset;

    // Draw laser bolt
    graphics.lineStyle(hit ? 3 : 2, color, hit ? 0.9 : 0.5);
    graphics.lineBetween(fromX, fromY, targetX, targetY);

    // Core line
    graphics.lineStyle(1, 0xffffff, hit ? 0.7 : 0.3);
    graphics.lineBetween(fromX, fromY, targetX, targetY);

    // Muzzle flash
    graphics.fillStyle(color, 0.8);
    graphics.fillCircle(fromX, fromY, 4);
    graphics.fillStyle(0xffffff, 0.6);
    graphics.fillCircle(fromX, fromY, 2);

    // Impact flash if hit
    if (hit) {
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillCircle(toX, toY, 6);
      graphics.fillStyle(color, 0.6);
      graphics.fillCircle(toX, toY, 10);
    }

    // Fade out
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: hit ? 150 : 100,
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * Create missile trail effect
   */
  fireMissile(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    duration: number = 500,
  ): void {
    audioManager.playSoundAt("missile_launch", fromX, fromY, 0.7);

    const missile = this.scene.add.graphics();
    missile.setDepth(15);
    missile.setPosition(fromX, fromY);

    // Draw missile
    missile.fillStyle(0x888888, 1);
    missile.fillTriangle(0, -4, -3, 4, 3, 4);
    missile.fillStyle(0xff6600, 0.8);
    missile.fillCircle(0, 6, 3);

    // Calculate angle
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    missile.setRotation(angle + Math.PI / 2);

    // Animate missile
    this.scene.tweens.add({
      targets: missile,
      x: toX,
      y: toY,
      duration,
      ease: "Quad.in",
      onUpdate: () => {
        // Add smoke trail
        const smoke = this.scene.add.graphics();
        smoke.setDepth(5);
        smoke.fillStyle(0x666666, 0.4);
        smoke.fillCircle(missile.x, missile.y, 2);
        this.scene.tweens.add({
          targets: smoke,
          alpha: 0,
          scale: 2,
          duration: 300,
          onComplete: () => smoke.destroy(),
        });
      },
      onComplete: () => {
        missile.destroy();
        this.createExplosion(toX, toY, "medium");
      },
    });
  }

  // ==========================================
  // SHIELD EFFECTS
  // ==========================================

  /**
   * Create shield impact effect
   */
  shieldImpact(x: number, y: number, angle: number, faction: FactionId): void {
    audioManager.playSoundAt("shield_hit", x, y, 0.6);

    const graphics = this.scene.add.graphics();
    graphics.setDepth(20);
    graphics.setPosition(x, y);

    const color = FACTION_COLORS[faction];

    // Draw shield ripple
    for (let i = 0; i < 3; i++) {
      const delay = i * 50;
      const ring = this.scene.add.graphics();
      ring.setDepth(20);
      ring.setPosition(x, y);
      ring.setAlpha(0);

      this.scene.time.delayedCall(delay, () => {
        ring.lineStyle(3 - i, color, 0.8 - i * 0.2);
        ring.strokeCircle(0, 0, 20 + i * 10);
        ring.setAlpha(1);

        this.scene.tweens.add({
          targets: ring,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 200,
          onComplete: () => ring.destroy(),
        });
      });
    }

    // Hexagonal shield pattern at impact point
    graphics.lineStyle(2, color, 0.8);
    graphics.strokeCircle(0, 0, 25);
    graphics.lineStyle(1, 0xffffff, 0.5);
    graphics.strokeCircle(0, 0, 20);

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 300,
      onComplete: () => graphics.destroy(),
    });
  }

  // ==========================================
  // EXPLOSIONS
  // ==========================================

  /**
   * Create explosion effect
   */
  createExplosion(
    x: number,
    y: number,
    size: "small" | "medium" | "large",
  ): void {
    // Play explosion sound based on size
    const soundType =
      size === "small"
        ? "explosion_small"
        : size === "medium"
          ? "explosion_medium"
          : "explosion_large";
    audioManager.playSoundAt(soundType, x, y, 0.8);

    const rawConfig = {
      small: { particles: 8, radius: 30, duration: 300 },
      medium: { particles: 15, radius: 60, duration: 500 },
      large: { particles: 25, radius: 100, duration: 700 },
    }[size];
    const config = {
      ...rawConfig,
      particles: Math.max(
        1,
        Math.round(rawConfig.particles * this.particleMultiplier),
      ),
    };

    const colors = [0xff4400, 0xff8800, 0xffaa00, 0xffff00];

    // Central flash
    const flash = this.scene.add.graphics();
    flash.setDepth(25);
    flash.fillStyle(0xffffff, 1);
    flash.fillCircle(x, y, config.radius * 0.4);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy(),
    });

    // Expanding ring
    const ring = this.scene.add.graphics();
    ring.setDepth(24);
    ring.lineStyle(3, 0xff6600, 0.8);
    ring.strokeCircle(x, y, 10);

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: config.radius / 10,
      scaleY: config.radius / 10,
      duration: config.duration,
      ease: "Quad.out",
      onComplete: () => ring.destroy(),
    });

    // Debris particles
    for (let i = 0; i < config.particles; i++) {
      const angle = (i / config.particles) * Math.PI * 2 + Math.random() * 0.5;
      const speed = config.radius * (0.5 + Math.random() * 0.5);
      const color = Phaser.Math.RND.pick(colors);
      const particleSize = 2 + Math.random() * (size === "large" ? 6 : 4);

      const particle = this.scene.add.graphics();
      particle.setDepth(23);
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, particleSize);
      particle.setPosition(x, y);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: config.duration * (0.7 + Math.random() * 0.6),
        ease: "Quad.out",
        onComplete: () => particle.destroy(),
      });
    }

    // Smoke cloud
    for (let i = 0; i < config.particles / 2; i++) {
      const smoke = this.scene.add.graphics();
      smoke.setDepth(22);
      smoke.fillStyle(0x333333, 0.4);
      smoke.fillCircle(0, 0, 5 + Math.random() * 10);
      smoke.setPosition(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 20,
      );

      this.scene.tweens.add({
        targets: smoke,
        y: smoke.y - 30 - Math.random() * 20,
        alpha: 0,
        scaleX: 3,
        scaleY: 3,
        duration: config.duration * 1.5,
        delay: Math.random() * 200,
        ease: "Quad.out",
        onComplete: () => smoke.destroy(),
      });
    }

    // Screen shake for large explosions
    if (this.cameraShakeEnabled) {
      if (size === "large") {
        this.scene.cameras.main.shake(200, 0.01);
      } else if (size === "medium") {
        this.scene.cameras.main.shake(100, 0.005);
      }
    }
  }

  // ==========================================
  // DAMAGE INDICATORS
  // ==========================================

  /**
   * Show floating damage number
   */
  showDamageNumber(
    x: number,
    y: number,
    damage: number,
    isCritical: boolean = false,
  ): void {
    if (!this.damageNumbersEnabled) return;
    const text = this.scene.add.text(x, y, `-${damage}`, {
      font: isCritical ? "bold 24px monospace" : "bold 18px monospace",
      color: isCritical ? "#ff0000" : "#ff6644",
      stroke: "#000000",
      strokeThickness: 3,
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(30);

    if (isCritical) {
      // Flash effect for crits
      text.setText(`CRIT! -${damage}`);
    }

    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      scale: isCritical ? 1.3 : 1,
      duration: 800,
      ease: "Quad.out",
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Show a floating status label (e.g. "ENGINES DISABLED!") — always shown,
   * not gated behind the damage-numbers preference since it's status info.
   */
  showFloatingText(x: number, y: number, text: string, color: string): void {
    const label = this.scene.add.text(x, y, text, {
      font: "bold 18px Arial",
      color,
      stroke: "#000000",
      strokeThickness: 3,
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(50);

    this.scene.tweens.add({
      targets: label,
      y: y - 60,
      alpha: 0,
      duration: 900,
      ease: "Power2",
      onComplete: () => label.destroy(),
    });
  }

  /**
   * Show healing/shield restore number
   */
  showHealNumber(
    x: number,
    y: number,
    amount: number,
    isShield: boolean = false,
  ): void {
    if (!this.damageNumbersEnabled) return;
    const text = this.scene.add.text(x, y, `+${amount}`, {
      font: "bold 16px monospace",
      color: isShield ? "#00aaff" : "#44ff44",
      stroke: "#000000",
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(30);

    this.scene.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 600,
      ease: "Quad.out",
      onComplete: () => text.destroy(),
    });
  }

  // ==========================================
  // KILL NOTIFICATIONS
  // ==========================================

  /**
   * Show kill notification
   */
  showKillNotification(
    killerName: string,
    victimName: string,
    x: number,
    y: number,
  ): void {
    const container = this.scene.add.container(x, y);
    container.setDepth(100);
    container.setScrollFactor(0);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(-150, -15, 300, 30, 5);
    container.add(bg);

    // Text
    const text = this.scene.add.text(
      0,
      0,
      `${killerName} destroyed ${victimName}`,
      {
        font: "bold 14px monospace",
        color: "#ff8844",
      },
    );
    text.setOrigin(0.5, 0.5);
    container.add(text);

    // Animate in and out
    container.setAlpha(0);
    container.setScale(0.8);

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: "Back.out",
      onComplete: () => {
        this.scene.time.delayedCall(2000, () => {
          this.scene.tweens.add({
            targets: container,
            alpha: 0,
            y: y - 30,
            duration: 300,
            onComplete: () => container.destroy(),
          });
        });
      },
    });
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  /**
   * Clean up all effects
   */
  destroy(): void {
    this.engineTrails.clear();
    this.trailGraphics.destroy();
    this.particleEmitters.forEach((e) => e.destroy());
    this.particleEmitters = [];
  }
}
