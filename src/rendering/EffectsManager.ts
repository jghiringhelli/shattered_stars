/**
 * Effects Manager — the battle scenes' one handle on visual effects, honouring
 * adaptive quality (PerformanceSystem) and the player's preferences:
 * - Engine trails (EngineTrails)
 * - Laser bolts and shield impacts (weaponEffects)
 * - Explosions and screen shake (explosionEffect)
 * - Damage / heal numbers, status labels and kill notices (floatingText)
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import type { EffectSettings } from "../systems/PerformanceSystem";
import { EngineTrails } from "./effects/EngineTrails";
import { drawLaser, drawShieldImpact } from "./effects/weaponEffects";
import { drawExplosion, type ExplosionSize } from "./effects/explosionEffect";
import {
  floatDamageNumber,
  floatHealNumber,
  floatStatusText,
  showKillNotice,
} from "./effects/floatingText";

/** Ship speed assumed for a trail when the caller gives none. */
const DEFAULT_TRAIL_SPEED = 2;

export class EffectsManager {
  private readonly scene: Phaser.Scene;
  private readonly trails: EngineTrails;
  private engineTrailsEnabled = true;
  private damageNumbersEnabled = true;
  private cameraShakeEnabled = true;
  private particleMultiplier = 1;

  /** @param scene - Scene the effects are drawn in. */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.trails = new EngineTrails(scene);
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
    if (!settings.engineTrails) this.trails.clear();
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

  /**
   * Register a ship for engine trail rendering (ignored while trails are off).
   * @param shipId - Ship id.
   * @param faction - Its faction (trail colour).
   * @param speed - Its speed (longer trails for faster ships).
   */
  registerEngineTrail(
    shipId: string,
    faction: FactionId,
    speed: number = DEFAULT_TRAIL_SPEED,
  ): void {
    if (!this.engineTrailsEnabled) return;
    this.trails.register(shipId, faction, speed);
  }

  /**
   * Update a ship's engine trail position.
   * @param shipId - Ship id.
   * @param x - Ship x.
   * @param y - Ship y.
   * @param angle - Heading in degrees (0 = up).
   */
  updateTrailPosition(
    shipId: string,
    x: number,
    y: number,
    angle: number,
  ): void {
    this.trails.update(shipId, x, y, angle);
  }

  /** @param shipId - Ship whose trail ends (destroyed). */
  removeEngineTrail(shipId: string): void {
    this.trails.remove(shipId);
  }

  /** Render all engine trails. */
  renderTrails(): void {
    this.trails.render();
  }

  /**
   * Create a laser bolt effect.
   * @param fromX - Shooter x.
   * @param fromY - Shooter y.
   * @param toX - Target x.
   * @param toY - Target y.
   * @param faction - Shooter's faction (bolt colour).
   * @param hit - Whether it hit (misses scatter and are fainter).
   */
  fireLaser(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    faction: FactionId,
    hit: boolean,
  ): void {
    drawLaser(this.scene, { fromX, fromY, toX, toY, faction, hit });
  }

  /**
   * Create a shield impact effect.
   * @param x - Impact x.
   * @param y - Impact y.
   * @param _angle - Impact angle (unused: the ripple is radial).
   * @param faction - Shielded ship's faction.
   */
  shieldImpact(x: number, y: number, _angle: number, faction: FactionId): void {
    drawShieldImpact(this.scene, x, y, faction);
  }

  /**
   * Create an explosion effect (medium/large shake the camera if enabled).
   * @param x - Centre x.
   * @param y - Centre y.
   * @param size - Explosion scale.
   */
  createExplosion(x: number, y: number, size: ExplosionSize): void {
    drawExplosion(this.scene, { x, y }, size, {
      particleMultiplier: this.particleMultiplier,
      cameraShake: this.cameraShakeEnabled,
    });
  }

  /**
   * Show a floating damage number (if damage numbers are enabled).
   * @param x - Hit x.
   * @param y - Hit y.
   * @param damage - Damage dealt.
   * @param isCritical - Show as a critical hit.
   */
  showDamageNumber(
    x: number,
    y: number,
    damage: number,
    isCritical: boolean = false,
  ): void {
    if (!this.damageNumbersEnabled) return;
    floatDamageNumber(this.scene, { x, y }, damage, isCritical);
  }

  /**
   * Show a floating status label (e.g. "ENGINES DISABLED!") — always shown,
   * not gated behind the damage-numbers preference since it's status info.
   * @param x - Label x.
   * @param y - Label y.
   * @param text - Label text.
   * @param color - CSS colour.
   */
  showFloatingText(x: number, y: number, text: string, color: string): void {
    floatStatusText(this.scene, { x, y }, text, color);
  }

  /**
   * Show a healing / shield-restore number (if damage numbers are enabled).
   * @param x - Ship x.
   * @param y - Ship y.
   * @param amount - Amount restored.
   * @param isShield - Shields (blue) rather than hull (green).
   */
  showHealNumber(
    x: number,
    y: number,
    amount: number,
    isShield: boolean = false,
  ): void {
    if (!this.damageNumbersEnabled) return;
    floatHealNumber(this.scene, { x, y }, amount, isShield);
  }

  /**
   * Show a kill notification banner.
   * @param killerName - Who scored the kill.
   * @param victimName - Who was destroyed.
   * @param x - Screen x.
   * @param y - Screen y.
   */
  showKillNotification(
    killerName: string,
    victimName: string,
    x: number,
    y: number,
  ): void {
    showKillNotice(this.scene, `${killerName} destroyed ${victimName}`, {
      x,
      y,
    });
  }

  /** Clean up all effects. */
  destroy(): void {
    this.trails.destroy();
  }
}
