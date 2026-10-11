/**
 * playstyles — how an effect's knobs vote for a play style
 * (playstyleCatalog.ts). Every CombatModifiers knob maps to the style it
 * serves (typed over the whole interface, so a new knob cannot ship without
 * a style), counted only in its beneficial direction (a drawback such as
 * "takes 10% more damage" never makes a card a tank).
 *
 * Pure: no Phaser, no state.
 */

import type {
  CombatModifiers,
  RealtimeEffect,
} from "../../core/CombatModifiers";
import { PLAYSTYLES, type Playstyle } from "./playstyleCatalog";

export * from "./playstyleCatalog";

/** Which way a knob helps: any positive value, or a multiplier below 1. */
type Benefit = "above_zero" | "below_one";

/** A knob's vote: the style it serves, when it helps, and its weight. */
interface KnobVote {
  readonly style: Playstyle;
  readonly benefit: Benefit;
  readonly weight: number;
}

/** Defining knobs (an aura projector IS support) outweigh incidental ones. */
const DEFINING_WEIGHT = 2;

const up = (s: Playstyle, weight = 1): KnobVote => ({
  style: s,
  benefit: "above_zero",
  weight,
});
const down = (s: Playstyle): KnobVote => ({
  style: s,
  benefit: "below_one",
  weight: 1,
});

const KNOB_VOTES: Readonly<Record<keyof CombatModifiers, KnobVote>> = {
  laserDamageBonus: up("striker"),
  calmLaserDamageBonus: up("marksman"),
  closeRangeLaserBonus: up("brawler"),
  rearArcLaserBonus: up("flanker"),
  bullseyeLaserBonus: up("marksman"),
  wingmanLaserBonus: up("wingman"),
  stressedLaserBonus: up("brawler"),
  damagedLaserBonus: up("brawler"),
  killFrenzyLaserBonus: up("hunter"),
  bonusDamageVsUnshielded: up("hunter"),
  damageTakenMultiplier: down("tank"),
  wingmanDamageTakenMultiplier: down("wingman"),
  shieldRegenPerSecond: up("tank"),
  hullRepairPerSecond: up("tank"),
  shieldsPerKill: up("hunter"),
  stressRateMultiplier: down("interceptor"),
  stressReliefTiers: up("interceptor"),
  maxSpeedBonus: up("interceptor"),
  boostCooldownMultiplier: down("interceptor"),
  barrelRollCooldownMultiplier: down("interceptor"),
  kturnCooldownMultiplier: down("interceptor"),
  cloakDurationBonus: up("ghost", DEFINING_WEIGHT),
  turretCooldownMultiplier: down("gunner"),
  ordnanceCooldownMultiplier: down("bomber"),
  ordnanceBonusCharges: up("bomber"),
  homingTurnBonus: up("bomber"),
  stressOnHit: up("suppressor"),
  projectsAura: up("support", DEFINING_WEIGHT),
  auraRadiusBonus: up("support"),
  deathBlastDamage: up("brawler"),
};

/** Votes per play style. */
export type PlaystyleScores = Readonly<Partial<Record<Playstyle, number>>>;

/**
 * @param scores - A tally.
 * @param voted - Style voted for.
 * @param weight - Vote weight.
 * @returns A new tally with the vote added.
 */
export function addVote(
  scores: PlaystyleScores,
  voted: Playstyle,
  weight = 1,
): PlaystyleScores {
  return { ...scores, [voted]: (scores[voted] ?? 0) + weight };
}

/**
 * @param effect - A real-time effect.
 * @returns Its beneficial knobs' votes.
 */
export function effectScores(effect: RealtimeEffect): PlaystyleScores {
  let scores: PlaystyleScores = {};
  for (const [key, vote] of Object.entries(KNOB_VOTES)) {
    const raw = effect[key as keyof CombatModifiers];
    if (raw === undefined) continue;
    const value = typeof raw === "boolean" ? Number(raw) : raw;
    const helps = vote.benefit === "above_zero" ? value > 0 : value < 1;
    if (helps) scores = addVote(scores, vote.style, vote.weight);
  }
  return scores;
}

/**
 * @param parts - Tallies to merge.
 * @returns Their sum.
 */
export function mergeScores(
  ...parts: readonly PlaystyleScores[]
): PlaystyleScores {
  let total: PlaystyleScores = {};
  for (const part of parts)
    for (const [voted, weight] of Object.entries(part))
      total = addVote(total, voted as Playstyle, weight);
  return total;
}

/**
 * The winning style; ties go to the style listed first in {@link PLAYSTYLES}.
 *
 * @param scores - A tally.
 * @param fallback - Style when nothing voted.
 * @returns The dominant style.
 */
export function dominantPlaystyle(
  scores: PlaystyleScores,
  fallback: Playstyle,
): Playstyle {
  let best: Playstyle = fallback;
  let bestScore = 0;
  for (const candidate of Object.keys(PLAYSTYLES) as Playstyle[]) {
    const score = scores[candidate] ?? 0;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
