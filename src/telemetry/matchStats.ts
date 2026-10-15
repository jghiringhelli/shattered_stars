/**
 * matchStats — a pure per-match combat stats accumulator. A battle scene
 * records what happens (shots, hits, damage, kills, the player's maneuvers
 * and special actions, marks, stressed time, repairs, ships deployed) and
 * `finish(outcome)` flattens it into one compact `match_summary` payload.
 *
 * Perspective: "friendly" is the player's side (player + allies/escorts),
 * "hostile" everyone else. Maneuver / special / stress / mark counts are the
 * player's own flying. Pure: no Phaser, no storage (the clock is injected).
 */

import type { ManeuverDifficulty } from "../core/types";
import { maneuverDifficultyOf } from "../systems/survival/maneuverDifficulty";
import type { TelemetryValue } from "./TelemetryLog";
import {
  isSpecialAction,
  type MatchStatEvent,
  type MatchSummary,
  type MatchWeapon,
  type SpecialAction,
} from "./matchStatTypes";

export * from "./matchStatTypes";

type Counters = {
  -readonly [
    K in keyof MatchSummary as K extends "mvpDamage"
      ? never
      : MatchSummary[K] extends number
        ? K
        : never
  ]: number;
};

const SPECIAL_FIELD: Readonly<Record<SpecialAction, keyof Counters>> = {
  kturn: "kturn",
  segnor: "segnor",
  tallon: "tallon",
  boost: "boost",
  barrel_roll: "barrelRoll",
};

const MANEUVER_FIELD: Readonly<Record<ManeuverDifficulty, keyof Counters>> = {
  green: "mvGreen",
  white: "mvWhite",
  red: "mvRed",
};

function zeroCounters(): Counters {
  return {
    durationMs: 0,
    kills: 0,
    losses: 0,
    playerDeaths: 0,
    shotsPrimary: 0,
    hitsPrimary: 0,
    shotsOrdnance: 0,
    hitsOrdnance: 0,
    enemyShots: 0,
    enemyHits: 0,
    dmgDealtHull: 0,
    dmgDealtShield: 0,
    dmgTakenHull: 0,
    dmgTakenShield: 0,
    mvGreen: 0,
    mvWhite: 0,
    mvRed: 0,
    kturn: 0,
    segnor: 0,
    tallon: 0,
    boost: 0,
    barrelRoll: 0,
    specials: 0,
    marks: 0,
    stressMs: 0,
    repairs: 0,
    repairHull: 0,
    deployedFriendly: 0,
    deployedHostile: 0,
  };
}

/**
 * @param value - A reported amount.
 * @returns The amount when it is a positive finite number, else 0.
 */
function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Damage a friendly ship dealt this match. */
interface DealerTally {
  readonly definitionId: string;
  damage: number;
}

export class MatchStatsAccumulator {
  private readonly counters = zeroCounters();
  private readonly hostileIds = new Set<string>();
  private readonly dealers = new Map<string, DealerTally>();
  private readonly startedAt: number;
  private firstKillAt: number | null = null;
  private finished = false;

  /**
   * @param mode - Mode id ("dogfight", "survival"...).
   * @param now - Clock (ms).
   * @param details - Flat start context copied into the summary.
   */
  constructor(
    private readonly mode: string,
    private readonly now: () => number,
    private readonly details: Readonly<Record<string, TelemetryValue>> = {},
  ) {
    this.startedAt = now();
  }

  /** Whether {@link finish} was called. */
  get isFinished(): boolean {
    return this.finished;
  }

  /**
   * Tally one event (ignored once finished).
   *
   * @param event - What happened.
   */
  record(event: MatchStatEvent): void {
    if (this.finished) return;
    const c = this.counters;
    switch (event.kind) {
      case "shot":
        return this.recordShot(event.friendly, event.weapon, event.hit);
      case "hit":
        return this.recordHit(event.friendly, event.weapon);
      case "damage":
        this.creditDealer(event);
        return this.recordDamage(event.toFriendly, event.hull, event.shield);
      case "kill":
        return this.recordKill(event.victimFriendly, event.victimIsPlayer);
      case "cycle":
        c[
          MANEUVER_FIELD[
            maneuverDifficultyOf(event.dial, event.direction, event.speed)
          ]
        ] += 1;
        return;
      case "flight":
        return this.recordFlight(event.events);
      case "mark":
        c.marks += 1;
        return;
      case "stress":
        if (event.stressed) c.stressMs += positive(event.ms);
        return;
      case "repair":
        if (event.shipId !== undefined && this.hostileIds.has(event.shipId))
          return;
        c.repairs += 1;
        c.repairHull += positive(event.hull);
        return;
      case "deploy":
        if (!event.friendly && event.shipId !== undefined)
          this.hostileIds.add(event.shipId);
        c[event.friendly ? "deployedFriendly" : "deployedHostile"] +=
          event.count ?? 1;
    }
  }

  /**
   * Close the match and flatten it.
   *
   * @param outcome - "victory", "defeat", "draw", "quit"...
   * @returns The `match_summary` payload.
   */
  finish(outcome: string): MatchSummary {
    this.finished = true;
    const mvp = this.mostValuableShip();
    return {
      ...this.details,
      ...this.counters,
      mode: this.mode,
      outcome,
      durationMs: Math.max(0, this.now() - this.startedAt),
      firstKillMs:
        this.firstKillAt === null ? null : this.firstKillAt - this.startedAt,
      mvpShip: mvp?.definitionId ?? null,
      mvpDamage: mvp?.damage ?? 0,
    };
  }

  /** Credit friendly damage to the ship that dealt it. */
  private creditDealer(
    event: Extract<MatchStatEvent, { kind: "damage" }>,
  ): void {
    if (event.toFriendly || !event.byShip) return;
    const dealt = positive(event.hull) + positive(event.shield);
    if (dealt <= 0) return;
    const entry = this.dealers.get(event.byShip.id) ?? {
      definitionId: event.byShip.definitionId,
      damage: 0,
    };
    entry.damage += dealt;
    this.dealers.set(event.byShip.id, entry);
  }

  /** @returns The friendly ship with the most damage dealt, or null. */
  private mostValuableShip(): DealerTally | null {
    let best: DealerTally | null = null;
    for (const entry of this.dealers.values()) {
      if (best === null || entry.damage > best.damage) best = entry;
    }
    return best;
  }

  private recordShot(
    friendly: boolean,
    weapon: MatchWeapon,
    hit: boolean,
  ): void {
    const c = this.counters;
    if (!friendly) c.enemyShots += 1;
    else c[weapon === "primary" ? "shotsPrimary" : "shotsOrdnance"] += 1;
    if (hit) this.recordHit(friendly, weapon);
  }

  private recordHit(friendly: boolean, weapon: MatchWeapon): void {
    const c = this.counters;
    if (!friendly) c.enemyHits += 1;
    else c[weapon === "primary" ? "hitsPrimary" : "hitsOrdnance"] += 1;
  }

  private recordDamage(
    toFriendly: boolean,
    hull: number,
    shield: number,
  ): void {
    const c = this.counters;
    c[toFriendly ? "dmgTakenHull" : "dmgDealtHull"] += positive(hull);
    c[toFriendly ? "dmgTakenShield" : "dmgDealtShield"] += positive(shield);
  }

  private recordKill(victimFriendly: boolean, victimIsPlayer = false): void {
    const c = this.counters;
    this.firstKillAt ??= this.now();
    c[victimFriendly ? "losses" : "kills"] += 1;
    if (victimIsPlayer) c.playerDeaths += 1;
  }

  private recordFlight(events: readonly string[]): void {
    for (const event of events) {
      if (!isSpecialAction(event)) continue;
      this.counters[SPECIAL_FIELD[event]] += 1;
      this.counters.specials += 1;
    }
  }
}
