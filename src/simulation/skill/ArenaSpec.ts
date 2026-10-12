/**
 * ArenaSpec — what a skill-arena battle is made of (sides, ships, pilots,
 * squads, seed, rules) and what it returns.
 *
 * Pure data.
 */

import type { BotTier, PilotBot } from "../../arcade/ai/BotTypes";
import type { CoordinationOptions } from "../../arcade/ai/SquadCoordinator";
import type { SideScore } from "../../systems/arena/BattleScore";
import type { TempoVariant } from "../TempoVariant";
import type { SideId, SideTally } from "./ArenaCombatState";
import type { ArenaRules } from "./ArenaRules";

/** Fixed simulation step: 60 Hz (ms). */
export const TICK_MS = 1000 / 60;

/** Default game-time limit of a battle (ms). */
export const DEFAULT_TIME_LIMIT_MS = 180_000;

/** Both sides, A first. */
export const SIDES: readonly SideId[] = ["A", "B"];

/** One ship of a side: its hull, its pilot and optionally its quick build. */
export interface ShipEntry {
  readonly definitionId: string;
  /** Pilot tier (flown by a BotPilot, as the scenes fly their AI). */
  readonly tier: BotTier;
  /** BotPilot reaction scale (Brutal 0.5); default 1. */
  readonly reactionScale?: number;
  /** A specific bot instead of the tier's (experiments). */
  readonly bot?: PilotBot;
  /** Quick build; omitted = the default one. */
  readonly loadoutId?: string | null;
}

/** A side's squad layer (SquadCommand with an AI leader). */
export interface SquadSetup {
  /** Coordination behaviours; default all on. */
  readonly coordination?: CoordinationOptions;
  /** The leader marks its focus (false: focus fire without marking); default true. */
  readonly aiLeader?: boolean;
  /** Delay of the squad's shared picture (ms); default the average pilot's. */
  readonly reactionMs?: number;
}

/** One side of a battle. */
export interface SideSpec {
  readonly ships: readonly ShipEntry[];
  /** Squad layer, or null for pilots flying on their own. */
  readonly squad: SquadSetup | null;
}

/** A battle to run. */
export interface BattleSpec {
  readonly A: SideSpec;
  readonly B: SideSpec;
  readonly seed: number;
  readonly timeLimitMs?: number;
  readonly rules?: ArenaRules;
  /** What-if tempo (experiments); omitted = the engine's. */
  readonly tempo?: TempoVariant;
}

/** How a battle ended. */
export interface BattleResult {
  readonly seed: number;
  readonly winner: SideId | "draw";
  readonly endedBy: "elimination" | "timeout";
  /** Battle length (real ms). */
  readonly durationMs: number;
  readonly scores: Readonly<Record<SideId, SideScore>>;
  readonly tallies: Readonly<Record<SideId, SideTally>>;
  readonly survivors: Readonly<Record<SideId, number>>;
  /** Real time of the first kill (ms), or null when nobody died. */
  readonly firstKillMs: number | null;
  /** Special actions (K-turn, Segnor, Tallon, boost, barrel roll) flown, all ships. */
  readonly specialsUsed: number;
}
