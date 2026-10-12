/**
 * ArenaCombatState — what combat reads and writes during a skill-arena
 * battle: ships, the CombatTempo immunity ledger, rules, scores, per-side
 * gunnery tallies, recent hits (focus fire / crossfire) and squad marks.
 *
 * Plain mutable simulation state. Pure: no Phaser.
 */

import type { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import type { WeaponsDriver } from "../../arcade/weapons/WeaponsDriver";
import type { SquadMarks } from "../../arcade/systems/SquadMark";
import type { SideScore } from "../../systems/arena/BattleScore";
import type { ArcPosition } from "../../arcade/ai/AiGeometry";
import type { ArenaRules } from "./ArenaRules";
import type { ArenaShip } from "./ArenaShip";
import type { SideId } from "./ArenaSide";
import type { ResolvedTempo } from "../TempoVariant";

export type { SideId } from "./ArenaSide";

/** What one side's guns did over a battle. */
export interface SideTally {
  shots: number;
  /** Primary hits (hit rate = hits / shots). */
  hits: number;
  /** Ordnance and turret hits (WeaponsDriver), apart from the primary hit rate. */
  ordnanceHits: number;
  /** Damage from every weapon. */
  damage: number;
  kills: number;
  /** Hits by where the attacker sat around its target. */
  readonly hitsByArc: Record<ArcPosition, number>;
  /** Shots taken while an ally hit the same target within the cycle. */
  focusFireShots: number;
  /** ...and from a different angle (crossfire). */
  crossfireShots: number;
  /** Shots taken from inside the arc of one of the target's allies. */
  coveredShots: number;
  /** Shots at a target flying with a wingman. */
  wingmanTargetShots: number;
  /** Shots at the target the side's squad marked. */
  markedShots: number;
}

/** @returns A tally with nothing in it. */
export function emptyTally(): SideTally {
  return {
    shots: 0,
    hits: 0,
    ordnanceHits: 0,
    damage: 0,
    kills: 0,
    hitsByArc: { front: 0, flank: 0, rear: 0 },
    focusFireShots: 0,
    crossfireShots: 0,
    coveredShots: 0,
    wingmanTargetShots: 0,
    markedShots: 0,
  };
}

/** A recent hit on a target: when, and from which world bearing (°). */
export interface RecentHit {
  readonly atMs: number;
  readonly bearingDeg: number;
}

/** Everything combat reads and writes during a battle. */
export interface CombatState {
  readonly ships: readonly ArenaShip[];
  readonly ledger: HitImmunityLedger;
  readonly rules: ArenaRules;
  readonly worldSize: number;
  readonly random: () => number;
  readonly scores: Record<SideId, SideScore>;
  readonly tallies: Record<SideId, SideTally>;
  /** Latest hit on each target per attacker, for the focus-fire / crossfire levers. */
  readonly recentHits: Map<string, Map<string, RecentHit>>;
  /** Each coordinated side's squad mark (SquadMark); replaced on every change. */
  marks: SquadMarks;
  /** What-if tempo (experiments); omitted = the engine's. */
  readonly tempo?: ResolvedTempo;
  /** Clock time of the first kill (combat's clock), once one happened. */
  firstKillAtMs?: number;
  /** The ships' secondaries (ArenaWeapons.armArena); omitted = primaries only. */
  weapons?: WeaponsDriver;
}
