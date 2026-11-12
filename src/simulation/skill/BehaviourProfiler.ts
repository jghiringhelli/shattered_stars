/**
 * BehaviourProfiler — watches the ships of a skill-arena battle tick by tick
 * and measures what a pilot does with them: aim and range, closing speed,
 * heading reversals, orbiting, throttle flapping, specials, stress, running
 * and idle flight. It only reads the arena's ship records (no effect on the
 * simulation), so the same battle flies the same with or without it.
 *
 * Pure: no Phaser.
 */

import { offNoseDeg, torusOffset } from "../../arcade/ai/AiGeometry";
import { capGroupOf } from "../../core/speedCap";
import type { ManeuverDirection } from "../../core/types";
import { REAR_ARC_HALF_DEG } from "../../arcade/ShotConditions";
import type { ArenaShip } from "./ArenaShip";
import {
  newProfile,
  pickTarget,
  IDLE_MARGIN_DEG,
  SAMPLE_MS,
  SPIN_CYCLES,
  STACK_PX,
  type DecisionCounts,
  type ShipMemory,
  type ShipProfile,
} from "./BehaviourProfile";

import { sampleShip } from "./BehaviourSamples";

/** Profiles every ship of one battle. */
export class BehaviourProfiler {
  private readonly profiles = new Map<string, ShipProfile>();
  private readonly memory = new Map<string, ShipMemory>();

  /**
   * @param worldSize - Torus edge (px).
   * @param decisions - Decision counts per ship id (from the recording bots).
   */
  constructor(
    private readonly worldSize: number,
    private readonly decisions: ReadonlyMap<string, DecisionCounts>,
  ) {}

  /** @returns The profile of every ship seen so far. */
  results(): ShipProfile[] {
    const out = [...this.profiles.values()];
    for (const profile of out) {
      const flown = this.decisions.get(profile.id);
      if (flown) Object.assign(profile.decisions, flown);
    }
    return out;
  }

  /**
   * A cycle committed on a ship: count the special it started.
   * @param ship - The ship.
   * @param started - The maneuver it started.
   */
  onCycle(ship: ArenaShip, started: ManeuverDirection): void {
    const profile = this.profileOf(ship);
    this.countCycle(ship, profile, started);
    this.countPlan(ship, profile, started);
    const group = capGroupOf(started);
    if (group === "kturn" || group === "segnor" || group === "tallon")
      profile.specialsFlown[group]++;
  }

  private countPlan(
    ship: ArenaShip,
    profile: ShipProfile,
    started: string,
  ): void {
    const intent = ship.pilot.intent;
    const asked = intent.special ?? intent.maneuver;
    if (asked === started) profile.asPlanned++;
    const wanted = intent.targetSpeed;
    if (wanted !== null && wanted !== ship.flight.motion.control.speed)
      profile.offThrottle++;
  }

  private countCycle(
    ship: ArenaShip,
    profile: ShipProfile,
    started: ManeuverDirection,
  ): void {
    const memory = this.memoryOf(ship, 0);
    const control = ship.flight.motion.control;
    profile.cycles++;
    profile.throttleShareSum += control.speed / Math.max(1, control.maxSpeed);
    if (!started.startsWith("turn")) {
      memory.turnStreak = 0;
      return;
    }
    profile.turnCycles++;
    memory.turnStreak++;
    if (memory.turnStreak === SPIN_CYCLES) profile.spinRuns++;
  }

  /**
   * Record one simulated tick (call after the flight and combat steps).
   * @param ships - Every ship of the battle.
   * @param nowMs - Battle time (ms).
   * @param tickMs - Tick length (ms).
   */
  tick(ships: readonly ArenaShip[], nowMs: number, tickMs: number): void {
    for (const ship of ships) {
      if (!ship.alive) continue;
      const enemies = ships.filter((s) => s.alive && s.side !== ship.side);
      const allies = ships.filter(
        (s) => s.alive && s.side === ship.side && s !== ship,
      );
      this.observeAllies(ship, allies, tickMs);
      this.observe(ship, enemies, nowMs, tickMs);
    }
  }

  private observeAllies(
    ship: ArenaShip,
    allies: readonly ArenaShip[],
    tickMs: number,
  ): void {
    if (allies.length === 0) return;
    const nearest = Math.min(
      ...allies.map((ally) => torusOffset(ship, ally, this.worldSize).distance),
    );
    const profile = this.profileOf(ship);
    profile.allyMs += tickMs;
    profile.allyDistanceSum += nearest * tickMs;
    if (nearest < STACK_PX) profile.stackedMs += tickMs;
  }

  private profileOf(ship: ArenaShip): ShipProfile {
    let profile = this.profiles.get(ship.id);
    if (!profile) {
      profile = newProfile(ship, this.decisions.get(ship.id));
      this.profiles.set(ship.id, profile);
    }
    return profile;
  }

  private memoryOf(ship: ArenaShip, nowMs: number): ShipMemory {
    let memory = this.memory.get(ship.id);
    if (!memory) {
      memory = {
        lastSampleMs: nowMs,
        lastAngle: ship.angle,
        lastDistances: new Map(),
        lastTurnSign: 0,
        lastTurnMs: -Infinity,
        lastSpeed: ship.flight.motion.control.speed,
        lastCooldown: ship.weaponCooldownMs,
        lastX: ship.x,
        lastY: ship.y,
        orbitTarget: null,
        lastBearing: null,
        orbitDeg: 0,
        closing: false,
        running: false,
        turnStreak: 0,
      };
      this.memory.set(ship.id, memory);
    }
    return memory;
  }

  private observe(
    ship: ArenaShip,
    enemies: readonly ArenaShip[],
    nowMs: number,
    tickMs: number,
  ): void {
    const profile = this.profileOf(ship);
    const memory = this.memoryOf(ship, nowMs);
    profile.aliveMs += tickMs;
    this.countEvents(ship, profile, memory, nowMs);
    const control = ship.flight.motion.control;
    if (control.cycleSpeed < control.speed) profile.cappedMs += tickMs;
    if (ship.flight.stress.isStressed) profile.stressedMs += tickMs;
    profile.stressSum += ship.flight.stress.level * tickMs;
    const target = pickTarget(ship, enemies, this.worldSize);
    if (!target) return;
    this.aim(ship, target, profile, tickMs);
    if (memory.closing) profile.closingMs += tickMs;
    if (memory.running) profile.runningMs += tickMs;
    if (nowMs - memory.lastSampleMs >= SAMPLE_MS)
      sampleShip({
        ship,
        target,
        enemies,
        profile,
        memory,
        worldSize: this.worldSize,
        nowMs,
      });
  }

  private countEvents(
    ship: ArenaShip,
    profile: ShipProfile,
    memory: ShipMemory,
    nowMs: number,
  ): void {
    const control = ship.flight.motion.control;
    if (control.speed !== memory.lastSpeed) profile.throttleChanges++;
    memory.lastSpeed = control.speed;
    if (ship.weaponCooldownMs > memory.lastCooldown) {
      profile.shots++;
      profile.firstShotMs ??= nowMs;
      memory.orbitDeg = 0;
    }
    memory.lastCooldown = ship.weaponCooldownMs;
    const jump = Math.max(
      Math.abs(ship.x - memory.lastX),
      Math.abs(ship.y - memory.lastY),
    );
    if (jump > this.worldSize / 2) profile.seamCrossings++;
    memory.lastX = ship.x;
    memory.lastY = ship.y;
  }

  private aim(
    ship: ArenaShip,
    target: ArenaShip,
    profile: ShipProfile,
    tickMs: number,
  ): void {
    const { distance } = torusOffset(ship, target, this.worldSize);
    const off = Math.abs(offNoseDeg(ship, target, this.worldSize));
    const stats = ship.combatStats;
    const inArc = off < stats.firingArc / 2;
    const inRange = distance < stats.weaponRange;
    if (inArc) profile.inArcMs += tickMs;
    if (inRange) profile.inRangeMs += tickMs;
    if (inArc && inRange) profile.inArcAndRangeMs += tickMs;
    const behind =
      Math.abs(offNoseDeg(target, ship, this.worldSize)) >=
      180 - REAR_ARC_HALF_DEG;
    if (behind && distance < stats.weaponRange * 1.5)
      profile.inTargetRearMs += tickMs;
    const control = ship.flight.motion.control;
    const straight =
      control.currentManeuver === "straight" &&
      (control.nextManeuver ?? "straight") === "straight";
    if (
      straight &&
      distance < stats.weaponRange * 1.2 &&
      off > stats.firingArc / 2 + IDLE_MARGIN_DEG
    )
      profile.idleInRangeMs += tickMs;
  }
}
