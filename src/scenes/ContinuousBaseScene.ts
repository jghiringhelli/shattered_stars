/**
 * ContinuousBaseScene — shared update loop for all real-time combat scenes.
 *
 * Handles: X-Wing cycle-engine flight (template arcs, cycle-boundary commits,
 * stress), weapon cooldown/firing, AI steering, sprite + health-bar
 * repositioning.
 *
 * Subclasses implement `onShipDestroyed` and `checkRoundEnd`.
 * Individual hooks (`performAttack`, `steerAiShip`, etc.) can be
 * overridden for scene-specific behaviour.
 */

import Phaser from "phaser";
import type { ManeuverDefinition } from "../core/types";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../config";
import type { FactionId } from "../config";
import { type ModeCombatStats } from "../data/ModeBalancing";
import { calculateHitChance } from "../data/ModeBalancing";
import { headingDiffToTarget } from "../systems/MovementSystem";
import {
  pursuitSpeed,
  steerAiFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../arcade/systems/CycleFlight";
import { canHullKTurn } from "../arcade/systems/AiPursuit";
import type { FlightEvent } from "../arcade/systems/PilotFlightTypes";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import type { ShipTelemetry } from "../debug/ShipTelemetry";
import { findClosestEnemy } from "../systems/BattleHelpers";
import { HealthBar } from "../ui/HealthBar";
import { EffectsManager } from "../rendering/EffectsManager";
import { ParallaxBackground } from "../rendering/ParallaxBackground";
import { audioManager } from "../audio/AudioManager";
import { syncListenerToCamera } from "../audio/CameraListener";
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
  /** Mirrors flight.motion.x — write through {@link ContinuousBaseScene.setFlight}. */
  x: number;
  /** Mirrors flight.motion.y — write through {@link ContinuousBaseScene.setFlight}. */
  y: number;
  /** Mirrors flight.motion.angle — write through {@link ContinuousBaseScene.setFlight}. */
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  /** Cycle-engine motion and pilot stress; x/y/angle mirror its pose. */
  flight: CycleFlightState;
  dial: readonly ManeuverDefinition[];
  /** True on the frame this ship's maneuver cycle committed. */
  cycleCommitted: boolean;
  weaponCooldown: number;
  combatStats: ModeCombatStats;
  /** Present only for capital-role ships; null/undefined for everything else. */
  capitalSystems?: CapitalSystemsState | null;
}

/** Minimal sprite container shape used by the base scene. */
export interface BaseShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

/** A pose on the battlefield. */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

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

  protected effectsManager!: EffectsManager;
  protected background!: ParallaxBackground;
  protected performanceState: PerformanceState = createPerformanceState();
  /** Debug pose recorder (?debug=1); sampled every frame by {@link flyShips}. */
  protected telemetry: ShipTelemetry | null = null;

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
   * Steer a single AI ship for this frame.
   * Default: chase the closest enemy along the true heading error.
   *
   * @param ship - The AI ship (alive, engines online).
   */
  protected steerAiShip(ship: T): void {
    const target = findClosestEnemy<T>(ship, this.ships);
    if (!target) return;
    this.steerToward(ship, target, this.headingErrorTo(ship, target));
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
      audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
    }
    if (damage > 0) {
      audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
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

  /**
   * Whether a ship can fly this frame: alive with its engines online
   * (a capital ship with its engines shot out drifts dead in space).
   *
   * @param ship - The ship.
   * @returns True if it flies and steers.
   */
  protected canFly(ship: T): boolean {
    if (ship.hull <= 0) return false;
    return !(ship.capitalSystems && isEnginesOffline(ship.capitalSystems));
  }

  /**
   * Flies every ship one frame on the X-Wing cycle engine (template arcs,
   * cycle-boundary commits, stress) and syncs sprites and telemetry to the
   * new poses.
   *
   * @param deltaMs - Frame length (ms).
   */
  protected flyShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (!this.canFly(ship)) {
        ship.cycleCommitted = false;
        continue;
      }
      const tick = tickCycleFlight(ship.flight, {
        deltaMs,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
      });
      this.setFlight(ship, tick.state);
      ship.cycleCommitted = tick.completed !== null;
      this.shipSprites
        .get(ship.id)
        ?.setPosition(ship.x, ship.y)
        .setAngle(ship.angle);
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
  }

  /**
   * Stores a ship's new flight state and mirrors its pose onto the record
   * (combat, AI and camera read x/y/angle).
   *
   * @param ship - The ship.
   * @param flight - Its new flight state.
   */
  protected setFlight(ship: T, flight: CycleFlightState): void {
    ship.flight = flight;
    ship.x = flight.motion.x;
    ship.y = flight.motion.y;
    ship.angle = flight.motion.angle;
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

  /** Steer every AI-controlled ship that can fly this frame. */
  protected updateAI(): void {
    for (const shipId of this.getAIShipIds()) {
      const ship = this.ships.get(shipId);
      if (ship && this.canFly(ship)) this.steerAiShip(ship);
    }
  }

  /**
   * Signed heading error from a ship's nose to a target.
   *
   * @param ship - The steering ship.
   * @param target - What it is chasing.
   * @returns Heading error (°): positive = target is to the right.
   */
  protected headingErrorTo(ship: T, target: T): number {
    return headingDiffToTarget(ship.x, ship.y, ship.angle, target.x, target.y);
  }

  /**
   * Queues an AI ship's next maneuver on the cycle engine: drift/bank/turn by
   * heading error, slowing to turn tight, K-turning onto a target behind it
   * (capital ships never K-turn).
   *
   * @param ship - The AI ship.
   * @param target - What it is chasing (sets its pursuit speed).
   * @param headingErrorDeg - Heading error it steers by (may be deliberately sloppy).
   */
  protected steerToward(ship: T, target: T, headingErrorDeg: number): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = steerAiFlight(ship.flight, {
      headingErrorDeg,
      desiredSpeed: pursuitSpeed(
        ship.flight.motion.control,
        this.headingErrorTo(ship, target),
      ),
      cycleCommitted: ship.cycleCommitted,
      allowKTurn: canHullKTurn(ship.definitionId),
    });
    this.setFlight(ship, result.state);
    this.playFlightEvents(ship, result.events, origin);
  }

  /**
   * Visual feedback for flight events, drawn from the pose they started at.
   *
   * @param ship - The ship that acted.
   * @param events - What happened this frame.
   * @param origin - Pose before the actions.
   */
  protected playFlightEvents(
    ship: T,
    events: readonly FlightEvent[],
    origin: Pose,
  ): void {
    for (const event of events) {
      playFlightEventFx(this, {
        event,
        origin,
        definitionId: ship.definitionId,
        faction: ship.faction,
        sprite: this.shipSprites.get(ship.id),
        cameraShake: false,
        zoomPulse: false,
      });
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
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    if (this.isPaused) return;

    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    this.updateAI();
    this.flyShips(delta);
    this.processCombat(delta);
    this.updateSpritePositions();
    this.checkRoundEnd();
  }
}
