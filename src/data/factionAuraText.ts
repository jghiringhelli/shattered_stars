/**
 * factionAuraText — the player-facing explanation of every faction aura, built
 * from the real constants (src/systems/aura/FactionAuras.ts) so the words can
 * never drift from the numbers. One read answers: WHO it covers, HOW FAR,
 * WHAT it changes, WHEN it stops, and gives one concrete example.
 *
 * - `short`: one sentence (tooltip hover line, pick screen, codex headline).
 * - `who` / `range` / `effect` / `ends` / `example`: the long form
 *   (encyclopedia, hold-Shift tooltip).
 *
 * Pure data; no Phaser.
 */

import { SHIP_SIZES, type FactionId } from "../config";
import { MAX_AURA_HIT_CHANCE_BONUS } from "../core/CombatModifiers";
import { AURA_HULL_REPAIR_RATIO } from "../systems/aura/AuraRepair";
import {
  AURA_STACKING,
  FACTION_AURAS,
  HERO_RADIUS_SCALE,
  MAX_STRESS_RELIEF_TIERS,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  SIZE_MAGNITUDE_MULTIPLIER,
  SIZE_RADIUS_MULTIPLIER,
  SWARM_EVADE_CAP,
  type FactionAura,
} from "../systems/aura/FactionAuras";

/** Longest short form: the tooltip / pick-screen line budget (characters). */
export const SHORT_AURA_LIMIT = 120;

/** Damage of the sample hit in the Rallying Banner example. */
const SAMPLE_HIT_DAMAGE = 3;
/** Seconds in the minute the Aegis Field example regenerates over. */
const SECONDS_PER_MINUTE = 60;

/** Everything a player reads about one aura. */
export interface FactionAuraText {
  readonly name: string;
  /** One sentence, at most {@link SHORT_AURA_LIMIT} characters. */
  readonly short: string;
  /** Who projects the field and who it covers. */
  readonly who: string;
  /** How far it reaches, in px and ship-lengths, and how hulls scale it. */
  readonly range: string;
  /** What it changes, with the real numbers. */
  readonly effect: string;
  /** When it stops, and the caps and stacking rules. */
  readonly ends: string;
  /** One concrete situation. */
  readonly example: string;
}

/** The faction-specific parts of an aura's text. */
interface EffectCopy {
  readonly shortEffect: string;
  readonly effect: string;
  readonly limits: string;
  readonly example: string;
}

/**
 * @param pixels - A distance in px.
 * @returns The distance in ship-lengths of the small base hull.
 */
export function shipLengths(pixels: number): number {
  return Math.round(pixels / SHIP_SIZES.small);
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

const AURA_SHIP = "an aura ship (support, capital or ace)";

const WHO =
  "Projected by your faction's support ships, capital ships and named aces, and by any ship carrying a coordinator crew or talent card. It covers the other ships of your faction, never the aura ship itself.";

const OFF_SWITCH =
  "It stops when the aura ship is destroyed or its systems go offline, or when a wingman leaves its radius.";

const STACKING = `A second aura ship adds only ${percent(AURA_STACKING.falloff)} of its strength; teammates of another faction get ${percent(AURA_STACKING.mixedTeamShare)}.`;

/**
 * @param aura - A faction's aura.
 * @returns The range sentence: px, ship-lengths and the hull scaling.
 */
function rangeText(aura: FactionAura): string {
  const px = aura.radius;
  return (
    `A medium support ship reaches ${px} px, about ${shipLengths(px)} ship-lengths (one ship-length = a small hull, ${SHIP_SIZES.small} px). ` +
    `Small hulls reach ×${SIZE_RADIUS_MULTIPLIER.small}, large ×${SIZE_RADIUS_MULTIPLIER.large}, capital ships ×${SIZE_RADIUS_MULTIPLIER.huge} at ${percent(SIZE_MAGNITUDE_MULTIPLIER.huge)} strength, named aces ×${HERO_RADIUS_SCALE} at full strength.`
  );
}

/** Ships needed to reach the swarm cap. */
function swarmCapShips(aura: FactionAura): number {
  return Math.ceil(SWARM_EVADE_CAP / aura.magnitude);
}

const EFFECT_COPY: Readonly<
  Record<FactionId, (aura: FactionAura) => EffectCopy>
> = {
  terran_hegemony: (aura) => ({
    shortEffect: `deal +${aura.magnitude} damage per hit`,
    effect: `Every hit they land does +${aura.magnitude} damage; the fraction averages out over many hits.`,
    limits: STACKING,
    example: `Fly a named ace with two wingmen within ${shipLengths(aura.radius)} ship-lengths: each hit those wingmen land does +${aura.magnitude} damage.`,
  }),
  free_confederation: (aura) => ({
    shortEffect: `take ${percent(aura.magnitude)} less damage`,
    effect: `Every hit they take does ${percent(aura.magnitude)} less damage.`,
    limits: `${STACKING} Overlapping fields never cut damage taken by more than ${percent(1 - MIN_DAMAGE_TAKEN_MULTIPLIER)}.`,
    example: `A Confederation support ship in the middle of three fighters: a hit that would do ${SAMPLE_HIT_DAMAGE} damage does about ${Math.round(SAMPLE_HIT_DAMAGE * (1 - aura.magnitude))} to each of them.`,
  }),
  synthetic_collective: (aura) => ({
    shortEffect: `take ${percent(aura.magnitude)} less damage per nearby drone, max ${percent(SWARM_EVADE_CAP)}`,
    effect: `Each other Collective ship within ${aura.radius} px of the aura ship cuts the damage they take by ${percent(aura.magnitude)}, up to ${percent(SWARM_EVADE_CAP)} (${swarmCapShips(aura)} ships).`,
    limits: `${STACKING} Overlapping fields never cut damage taken by more than ${percent(1 - MIN_DAMAGE_TAKEN_MULTIPLIER)}.`,
    example: `A Collective support ship with ${swarmCapShips(aura)} drones within ${shipLengths(aura.radius)} ship-lengths: each of those drones takes ${percent(SWARM_EVADE_CAP)} less damage, while a lone drone takes full damage.`,
  }),
  void_corsairs: (aura) => ({
    shortEffect: `fly one stress tier easier, +${percent(aura.hitChanceBonus ?? 0)} to hit`,
    effect: `Their maneuvers count one tier easier for stress (a red move builds stress like a white one, a white one like a green one) and their shots get +${percent(aura.hitChanceBonus ?? 0)} to hit.`,
    limits: `${STACKING} Stress relief is capped at ${MAX_STRESS_RELIEF_TIERS} tiers and the hit bonus at +${percent(MAX_AURA_HIT_CHANCE_BONUS)}, however many fields overlap.`,
    example: `A Corsair ace leads two raiders in a loose line ${shipLengths(aura.radius)} ship-lengths wide: their red turns build stress like white ones and their shots get +${percent(aura.hitChanceBonus ?? 0)} to hit.`,
  }),
  ascendant_empire: (aura) => ({
    shortEffect: `regenerate ${aura.magnitude} shield points per second`,
    effect: `They regenerate ${aura.magnitude} shield points per second (${aura.magnitude} HP/s) up to their full shields; support and capital aura ships also patch ${(aura.magnitude * AURA_HULL_REPAIR_RATIO).toFixed(2)} hull per second.`,
    limits: `Fields from several aura ships add up in full; teammates of another faction get ${percent(AURA_STACKING.mixedTeamShare)}.`,
    example: `An Ascendant support ship flies beside two fighters: each fighter regains ${aura.magnitude} shield points per second, ${Math.round(aura.magnitude * SECONDS_PER_MINUTE)} points in a minute.`,
  }),
};

/**
 * @param faction - A faction.
 * @returns Its aura explained for the player, numbers read from the code.
 */
function buildAuraText(faction: FactionId): FactionAuraText {
  const aura = FACTION_AURAS[faction];
  const copy = EFFECT_COPY[faction](aura);
  return {
    name: aura.name,
    short: `Wingmen within ${shipLengths(aura.radius)} ship-lengths of ${AURA_SHIP} ${copy.shortEffect}.`,
    who: WHO,
    range: rangeText(aura),
    effect: copy.effect,
    ends: `${OFF_SWITCH} ${copy.limits}`,
    example: copy.example,
  };
}

/** Every faction's aura text, keyed by faction. */
export const FACTION_AURA_TEXT: Readonly<Record<FactionId, FactionAuraText>> =
  Object.fromEntries(
    (Object.keys(FACTION_AURAS) as FactionId[]).map((faction) => [
      faction,
      buildAuraText(faction),
    ]),
  ) as Record<FactionId, FactionAuraText>;
