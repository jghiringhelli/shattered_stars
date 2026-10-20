/**
 * Which music a game situation calls for — the bridge between game state
 * (survival plans, campaign missions, flagship hull) and the track catalog.
 *
 * Structural input types keep this module free of survival/campaign imports.
 */

import type { BattleMusicMode, MusicTrack } from "./musicTracks";
import { BOSS_PHASE_3_HULL_RATIO } from "../systems/EpicBossRules";

/**
 * Survival belt squeeze at a node's first wave from which the asteroid track
 * plays — half of MAX_BELT_STEPS (12), i.e. from mid sector 2 on.
 */
export const BELT_HEAVY_STEPS = 6;

/** Flagship hull fraction at or below which Shields Low comes in. */
export const TENSION_ENTER_HULL_FRACTION = 0.25;

/** Hull fraction the flagship must recover past before tension clears. */
export const TENSION_EXIT_HULL_FRACTION = 0.4;

/** The parts of a Survival combat plan that matter to music. */
export interface SurvivalMusicPlan {
  readonly kind: string;
  readonly beltSteps: number;
}

/** The parts of a campaign mission that matter to music. */
export interface CampaignMusicMission {
  /** Mission archetype; a "boss" mission always plays boss music. */
  readonly style?: string;
  readonly enemies: ReadonlyArray<{ readonly isBoss?: boolean }>;
  readonly hazards?: ReadonlyArray<{ readonly kind: string }>;
}

/**
 * @param plan - The node's combat plan.
 * @returns boss for sector bosses, hazard for belt-heavy nodes, else skirmish.
 */
export function survivalBattleMode(plan: SurvivalMusicPlan): BattleMusicMode {
  if (plan.kind === "boss") return "boss";
  return plan.beltSteps >= BELT_HEAVY_STEPS ? "hazard" : "skirmish";
}

/**
 * @param mission - The mission being flown.
 * @returns boss when it fields a boss, hazard when it has hazards, else skirmish.
 */
export function campaignBattleMode(
  mission: CampaignMusicMission,
): BattleMusicMode {
  if (mission.style === "boss") return "boss";
  if (mission.enemies.some((enemy) => enemy.isBoss === true)) return "boss";
  return (mission.hazards?.length ?? 0) > 0 ? "hazard" : "skirmish";
}

/**
 * Campaign script cues that are procedural stingers layered over the battle
 * music (the other cues switch the battle track).
 */
const CAMPAIGN_STINGER_CUES: Readonly<Record<string, MusicTrack>> = {
  broadcast: "broadcast_click",
  tide_motif: "tide_motif",
};

/**
 * @param cue - A campaign script music cue name.
 * @returns The stinger track it layers, or null for a track-switching cue.
 */
export function campaignStingerTrack(cue: string): MusicTrack | null {
  return CAMPAIGN_STINGER_CUES[cue] ?? null;
}

/**
 * @param activeKind - The run's open node kind (null while choosing a route).
 * @returns The cantina in the shop, Long Haul everywhere else on the map.
 */
export function survivalMapMusic(activeKind: string | null): MusicTrack {
  return activeKind === "shop" ? "survival_shop" : "long_haul";
}

/**
 * Low-hull tension with hysteresis, so it does not flap at the threshold.
 *
 * @param active - Whether tension is currently raised.
 * @param hullFraction - Flagship hull / max hull.
 * @returns Whether tension should be raised now.
 */
export function nextLowHullTension(
  active: boolean,
  hullFraction: number,
): boolean {
  if (hullFraction <= 0) return false;
  if (active) return hullFraction <= TENSION_EXIT_HULL_FRACTION;
  return hullFraction <= TENSION_ENTER_HULL_FRACTION;
}

/** The parts of a ship that matter to tension music. */
export interface MusicHull {
  readonly hull: number;
  readonly maxHull: number;
}

/**
 * The flagship hull fraction fed to the low-hull tension layer.
 *
 * @param ship - The player's flagship, or null once it is lost.
 * @returns Hull / max hull; 0 for a lost ship or one without max hull.
 */
export function hullFractionOf(ship: MusicHull | null | undefined): number {
  if (!ship || ship.maxHull <= 0) return 0;
  return ship.hull / ship.maxHull;
}

/** A battle ship that may be tagged as a boss. */
export interface MusicBossCandidate extends MusicHull {
  readonly tags?: readonly string[];
}

/**
 * Whether a boss is in its final phase: a living boss at or under Boss
 * Raid's critical-phase hull ratio (for modes without scripted phases).
 *
 * @param ships - The battle's ships; bosses carry the "boss" tag.
 * @returns True while any living boss is that low.
 */
export function bossFinalPhase(ships: Iterable<MusicBossCandidate>): boolean {
  for (const ship of ships) {
    if (!ship.tags?.includes("boss") || ship.hull <= 0) continue;
    if (hullFractionOf(ship) <= BOSS_PHASE_3_HULL_RATIO) return true;
  }
  return false;
}
