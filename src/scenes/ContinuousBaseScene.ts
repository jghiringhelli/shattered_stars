/**
 * ContinuousBaseScene — shared update loop for all real-time combat scenes.
 *
 * Handles: maneuver step, position interpolation, weapon cooldown/firing,
 * AI movement decisions, sprite + health-bar repositioning.
 *
 * Subclasses implement `onShipDestroyed` and `checkRoundEnd`.
 * Individual hooks (`performAttack`, `pickManeuverForShip`, etc.) can be
 * overridden for scene-specific behaviour.
 */

import Phaser from "phaser";
import type { ManeuverDirection } from "../core/types";
import { BATTLEFIELD_SIZE } from "../config";
import type { FactionId } from "../config";
import { type ModeCombatStats } from "../data/ModeBalancing";
import { calculateHitChance } from "../data/ModeBalancing";
import {
  getManeuverTemplate,
  applyManeuver,
} from "../systems/ManeuverTemplates";
import { getShipDial } from "../data/ShipDefinitions";
import { headingDiffToTarget } from "../systems/MovementSystem";
import { findClosestEnemy } from "../systems/BattleHelpers";
import { HealthBar } from "../ui/HealthBar";
import { EffectsManager } from "../rendering/EffectsManager";
import { ParallaxBackground } from "../rendering/ParallaxBackground";
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from "../systems/PerformanceSystem";
import {
  applyCapitalSystemDamage,
  isEnginesOffline,
  sumSystemsHull,
  SYSTEM_LABELS,
  type CapitalSystemsState,
} from "../systems/CapitalSystems";

/** Minimum ship data required by the shared combat loop. */
export interface ContinuousShip {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  currentManeuverDir: ManeuverDirection;
  currentSpeed: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  weaponCooldown: number;
  combatStats: ModeCombatStats;
  /** Present only for capital-role ships; null/undefined for everything else. */
  capitalSystems?: CapitalSystemsState | null;
}

/** Minimal sprite container shape used by the base scene. */
export interface BaseShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

/** Default animation duration in ms — slightly under maneuver interval for smoothness. */
const MANEUVER_ANIMATION_DURATION = 280;

export abstract class ContinuousBaseScene<
  T extends ContinuousShip,
  S extends BaseShipSprite = BaseShipSprite,
>
  extends Phaser.Scene
{
  protected ships: Map<string, T> = new Map();
  protected shipSprites: Map<string, S> = new Map();
  protected healthBars: Map<string, HealthBar> = new Map();

  protected isPaused = false;
  protected isActive = false;
  protected lastManeuverTime = 0;

  protected effectsManager!: EffectsManager;
  protected background!: ParallaxBackground;
  protected performanceState: PerformanceState = createPerformanceState();

  // ──────────────────────────────────────────────
  // Abstract — each scene must implement these
  // ──────────────────────────────────────────────

  /** Called when a ship's hull reaches 0. Handles cleanup and scoring. */
  protected abstract onShipDestroyed(shipId: string, killerId?: string): void;

  /** Called every frame after sprites update; check win/loss conditions here. */
  protected abstract checkRoundEnd(): void;

  // ──────────────────────────────────────────────
  // Overridable hooks
  // ──────────────────────────────────────────────

  /**
   * Returns the IDs of ships that should receive AI movement decisions.
   * Default: all ships with owner === 'ai'.
   */
  protected getAIShipIds(): string[] {
    return [...this.ships.keys()].filter(
      (id) => this.ships.get(id)?.owner === "ai",
    );
  }

  /** Milliseconds between maneuver commits. */
  protected getManeuverInterval(): number {
    return 300;
  }

  /**
   * Fire a single attack from attacker → target.
   * Override for ability bonuses, difficulty modifiers, stats tracking, etc.
   */
  protected performAttack(attacker: T, target: T): void {
    const hitChance = calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice,
    );
    const hit = Math.random() < hitChance;
    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      hit,
    );
    if (hit) {
      this.applyDamage(attacker, target, attacker.combatStats.attackDice);
    }
  }

  /**
   * Apply maneuver templates for all ships and update interpolation targets.
   * Override to add per-step effects (e.g. shield regen).
   */
  protected runManeuverStep(): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      if (ship.capitalSystems && isEnginesOffline(ship.capitalSystems))
        continue;
      const template = getManeuverTemplate(
        ship.currentManeuverDir,
        ship.currentSpeed,
      );
      const result = applyManeuver(ship.x, ship.y, ship.angle, template);
      ship.targetX = result.x;
      ship.targetY = result.y;
      ship.targetAngle = result.angle;
    }
  }

  /**
   * Pick and commit the next maneuver for a single ship.
   * Default: straight when aligned, bank toward closest enemy otherwise.
   */
  protected pickManeuverForShip(ship: T): void {
    const target = findClosestEnemy<T>(ship, this.ships);
    if (!target) return;
    this.pickAndSetManeuver(ship, target);
  }

  // ──────────────────────────────────────────────
  // Shared concrete methods
  // ──────────────────────────────────────────────

  /**
   * Apply damage from attacker to target with shield absorption,
   * update the health bar, and trigger destruction if hull ≤ 0.
   */
  protected applyDamage(attacker: T, target: T, damage: number): void {
    if (target.shields > 0) {
      const absorbed = Math.min(target.shields, damage);
      target.shields -= absorbed;
      damage -= absorbed;
    }
    if (damage > 0) {
      if (target.capitalSystems) {
        const result = applyCapitalSystemDamage(target.capitalSystems, damage);
        target.capitalSystems = result.systems;
        target.hull = sumSystemsHull(result.systems);
        if (result.justDisabled && result.hitSystemId) {
          this.effectsManager.showFloatingText(
            target.x,
            target.y - 45,
            `${SYSTEM_LABELS[result.hitSystemId]} DISABLED!`,
            "#ff8800",
          );
        }
      } else {
        target.hull = Math.max(0, target.hull - damage);
      }
    }
    this.healthBars.get(target.id)?.update(target.hull, target.shields);
    if (target.hull <= 0) {
      this.onShipDestroyed(target.id, attacker.id);
    }
  }

  /**
   * Returns the nearest enemy ship within weapon range and firing arc,
   * or null if none is in range.
   */
  protected findWeaponTarget(ship: T): T | null {
    const maxRange = ship.combatStats.weaponRange;
    const maxArcRad = (ship.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;
    let best: T | null = null;
    let bestDist = Infinity;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;
      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      if (dist >= maxRange || dist >= bestDist) continue;
      const angleToTarget = Phaser.Math.Angle.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      const shipFacing = (ship.angle - 90) * Phaser.Math.DEG_TO_RAD;
      let arcDiff = Math.abs(angleToTarget - shipFacing);
      if (arcDiff > Math.PI) arcDiff = Math.PI * 2 - arcDiff;
      if (arcDiff < maxArcRad) {
        best = other as T;
        bestDist = dist;
      }
    }
    return best;
  }

  /** Lerp all ship positions toward their targets and wrap at battlefield edge. */
  protected interpolatePositions(delta: number): void {
    const t = Math.min(1, delta / MANEUVER_ANIMATION_DURATION) * 3;

    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      ship.x = Phaser.Math.Linear(ship.x, ship.targetX, t);
      ship.y = Phaser.Math.Linear(ship.y, ship.targetY, t);

      let angleDiff = ship.targetAngle - ship.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      ship.angle = (((ship.angle + angleDiff * t) % 360) + 360) % 360;

      ship.x =
        ((ship.x % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.y =
        ((ship.y % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.targetX =
        ((ship.targetX % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
        BATTLEFIELD_SIZE;
      ship.targetY =
        ((ship.targetY % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
        BATTLEFIELD_SIZE;

      const sprite = this.shipSprites.get(ship.id);
      if (sprite) {
        sprite.setPosition(ship.x, ship.y);
        sprite.setAngle(ship.angle);
      }
    }
  }

  /** Tick weapon cooldowns and fire at targets when ready. */
  protected processCombat(delta: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);
      if (ship.weaponCooldown <= 0) {
        const target = this.findWeaponTarget(ship);
        if (target) {
          this.performAttack(ship, target);
          ship.weaponCooldown = ship.combatStats.weaponCooldown;
        }
      }
    }
  }

  /** Run AI movement decisions for all AI-controlled ships. */
  protected updateAI(): void {
    for (const shipId of this.getAIShipIds()) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;
      this.pickManeuverForShip(ship);
    }
  }

  /**
   * Pure heading-diff → maneuver selection.
   * Picks straight when aligned within 20°, bank/turn in the appropriate direction otherwise.
   */
  protected pickAndSetManeuver(ship: T, target: T): void {
    const angleDiff = headingDiffToTarget(
      ship.x,
      ship.y,
      ship.angle,
      target.x,
      target.y,
    );
    const dial = getShipDial(ship.definitionId);

    if (Math.abs(angleDiff) < 20) {
      const m = dial.find((d) => d.direction === "straight");
      if (m) {
        ship.currentManeuverDir = "straight";
        ship.currentSpeed = m.speed;
      }
    } else if (angleDiff > 0) {
      const m = dial.find(
        (d) => d.direction === "bank_right" || d.direction === "turn_right",
      );
      if (m) {
        ship.currentManeuverDir = m.direction;
        ship.currentSpeed = m.speed;
      }
    } else {
      const m = dial.find(
        (d) => d.direction === "bank_left" || d.direction === "turn_left",
      );
      if (m) {
        ship.currentManeuverDir = m.direction;
        ship.currentSpeed = m.speed;
      }
    }
  }

  /** Reposition health bars to track ship sprites. */
  protected updateSpritePositions(): void {
    for (const [id, ship] of this.ships) {
      if (ship.hull <= 0) continue;
      this.healthBars.get(id)?.setPosition(ship.x, ship.y - 40);
    }
  }

  // ──────────────────────────────────────────────
  // Main loop
  // ──────────────────────────────────────────────

  override update(time: number, delta: number): void {
    if (this.isPaused) return;

    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    if (time - this.lastManeuverTime >= this.getManeuverInterval()) {
      this.runManeuverStep();
      this.lastManeuverTime = time;
    }

    this.interpolatePositions(delta);
    this.processCombat(delta);
    this.updateAI();
    this.updateSpritePositions();
    this.checkRoundEnd();
  }
}
