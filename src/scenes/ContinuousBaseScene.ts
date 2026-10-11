/**
 * ContinuousBaseScene — shared update loop for all real-time combat scenes.
 *
 * Handles: X-Wing cycle-engine flight (template arcs, cycle-boundary commits,
 * stress), quick builds (upgrades + pilot ability: stat bonuses, flight,
 * cycle stress, shield regen, dice shots, kill rewards and death blasts),
 * weapon cooldown/firing, AI steering, sprite + health-bar repositioning.
 *
 * Subclasses implement `onShipDestroyed` and `checkRoundEnd`, and equip
 * every ship they spawn with `equipShip`.
 * Individual hooks (`shotDice`, `landShot`, `steerAiShip`, etc.) can be
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
import {
  equipFlight,
  equipQuickBuild,
  regenerateShields,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
  type DiceAttackResult,
} from "../arcade/systems/DiceAttack";
import {
  deathBlastTargets,
  hasWingman,
  rewardKill,
} from "../arcade/PilotAbilityCombat";
import { applyInstantStress } from "../arcade/ArcadeStress";
import type { CombatModifiers } from "../core/CombatModifiers";
import { random } from "../utils/random";
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
  createCapitalSystems,
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
  /** Quick build flown (upgrades + pilot), or null for the bare hull. */
  loadoutId: string | null;
  /** Real-time effects of the quick build; set by {@link ContinuousBaseScene.equipShip}. */
  modifiers: CombatModifiers;
  /** Scene time (ms) until which a kill-frenzy ability is active. */
  frenzyUntilMs: number;
}

/** The mode's dice for one shot, before equipment. */
export interface ShotDice {
  /** Hit probability (difficulty included). */
  readonly hitChance: number;
  /** Damage on a hit (difficulty and system damage included). */
  readonly baseDamage: number;
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
   * Fire a single attack from attacker → target: one dice roll with the
   * attacker's equipment and pilot ability applied.
   * Override {@link shotDice} / {@link landShot} for scene-specific odds and
   * hit feedback.
   *
   * @param attacker - The ship firing.
   * @param target - The ship fired at.
   */
  protected performAttack(attacker: T, target: T): void {
    const result = this.rollShot(attacker, target);
    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      result.hit,
    );
    if (result.hit) this.landShot(attacker, target, result);
  }

  /**
   * The mode's dice for a shot. Default: the continuous dice model.
   *
   * @param attacker - The ship firing.
   * @param target - The ship fired at.
   * @returns Hit chance and base damage before equipment.
   */
  protected shotDice(attacker: T, target: T): ShotDice {
    return {
      hitChance: calculateHitChance(
        attacker.combatStats.attackDice,
        target.combatStats.agilityDice,
      ),
      baseDamage: attacker.combatStats.attackDice,
    };
  }

  /**
   * A shot that hit: stress on the target's pilot, then the damage.
   *
   * @param attacker - The ship that fired.
   * @param target - The ship hit.
   * @param result - The resolved shot.
   */
  protected landShot(attacker: T, target: T, result: DiceAttackResult): void {
    this.setFlight(target, {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
    });
    this.applyDamage(attacker, target, result.damage);
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
   * Equip a freshly built ship with its quick build: stat bonuses, the
   * modifier sheet (upgrades + pilot ability) and its flight changes. Call
   * once, before the ship fights (stat bonuses stack if called twice).
   *
   * @param ship - The new ship (bumped in place).
   * @param loadoutId - Its quick build, or null for the bare hull.
   */
  protected equipShip(ship: T, loadoutId: string | null): void {
    ship.loadoutId = loadoutId;
    ship.modifiers = equipQuickBuild(ship, loadoutId);
    this.setFlight(ship, equipFlight(ship.flight, ship.modifiers));
    if (ship.capitalSystems) {
      ship.capitalSystems = createCapitalSystems(ship.hull);
    }
  }

  /**
   * Roll one shot from the scene RNG with the attacker's equipment.
   *
   * @param attacker - The ship firing.
   * @param target - The ship fired at.
   * @returns Hit, damage after equipment and mitigation, stress inflicted.
   */
  protected rollShot(attacker: T, target: T): DiceAttackResult {
    return resolveDiceAttack({
      ...this.shotDice(attacker, target),
      attacker: combatantOf(attacker),
      target: combatantOf(target),
      attackerHasWingman: this.fliesWithWingman(attacker),
      targetHasWingman: this.fliesWithWingman(target),
      nowMs: this.time.now,
      roll: random.next(),
    });
  }

  /**
   * @param ship - The ship asking.
   * @returns Whether another living ship of its side flies within wingman range.
   */
  protected fliesWithWingman(ship: T): boolean {
    const allies = [...this.ships.values()].filter(
      (other) => other.faction === ship.faction && other.hull > 0,
    );
    return hasWingman(ship, allies);
  }

  /**
   * Pilot-ability effects of a kill: the killer's reward (shields, frenzy)
   * and the victim's death blast on enemies nearby (which can kill in turn).
   *
   * @param killer - The ship that made the kill.
   * @param victim - The ship destroyed.
   */
  protected resolveAbilityKill(killer: T, victim: T): void {
    if (killer.hull > 0) {
      Object.assign(killer, rewardKill(combatantOf(killer), this.time.now));
      this.healthBars.get(killer.id)?.update(killer.hull, killer.shields);
    }
    const enemies = [...this.ships.values()].filter(
      (other) => other.faction !== victim.faction && other.hull > 0,
    );
    for (const caught of deathBlastTargets(combatantOf(victim), enemies)) {
      this.applyDamage(victim, caught, victim.modifiers.deathBlastDamage);
    }
  }

  /**
   * Apply damage from attacker to target with shield absorption,
   * update the health bar, and trigger destruction (with the pilot-ability
   * kill effects) if hull ≤ 0. A ship already destroyed takes nothing.
   *
   * @param attacker - The ship credited with the damage.
   * @param target - The ship taking it.
   * @param damage - Damage (shields first, then hull or capital systems).
   */
  protected applyDamage(attacker: T, target: T, damage: number): void {
    if (target.hull <= 0) return;
    const shieldsBefore = target.shields;
    const absorbed = absorbDamage(target, damage);
    const hullDamage = damage - (shieldsBefore - absorbed.shields);
    target.shields = absorbed.shields;
    if (shieldsBefore > 0) {
      audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
    }
    if (hullDamage > 0) {
      audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
      if (target.capitalSystems) {
        this.damageCapitalSystems(target, hullDamage);
      } else {
        target.hull = absorbed.hull;
      }
    }
    this.healthBars.get(target.id)?.update(target.hull, target.shields);
    if (target.hull <= 0) {
      this.resolveAbilityKill(attacker, target);
      this.onShipDestroyed(target.id, attacker.id);
    }
  }

  /**
   * Hull damage to a capital ship lands on one of its systems; announces a
   * system it just disabled.
   *
   * @param target - The capital ship.
   * @param damage - Hull damage past its shields.
   */
  private damageCapitalSystems(target: T, damage: number): void {
    if (!target.capitalSystems) return;
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
      if (ship.hull > 0) this.regenerateShipShields(ship, deltaMs);
      if (!this.canFly(ship)) {
        ship.cycleCommitted = false;
        continue;
      }
      const tick = tickCycleFlight(ship.flight, {
        deltaMs,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
        modifiers: stressModifiersOf(ship.modifiers),
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
   * Regenerates a ship's shields for a frame (shield-regen equipment only).
   *
   * @param ship - A living ship.
   * @param deltaMs - Frame length (ms).
   */
  private regenerateShipShields(ship: T, deltaMs: number): void {
    const shields = regenerateShields(
      ship.shields,
      ship.maxShields,
      ship.modifiers,
      deltaMs,
    );
    if (shields === ship.shields) return;
    ship.shields = shields;
    this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
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
