/**
 * SkillLevers — named rule sets the lever report measures: the engine (its
 * shot levers as shipped), the bare dice model, each adopted lever alone,
 * and the prototypes that were NOT adopted (kept for the record).
 *
 * Adopted (live in the engine): position (ShotLevers: rear arc, head-on) and
 * squad mark (SquadMark). Not adopted: cadence, wingman defence, suppression.
 *
 * Pure: no Phaser.
 */

import { DEFAULT_SHOT_LEVERS, NO_SHOT_LEVERS } from "../../arcade/ShotLevers";
import { ENGINE_RULES, type ArenaRules } from "./ArenaRules";

/** A named rule set. */
export interface LeverCandidate {
  readonly name: string;
  /** What it is and which gate it targets. */
  readonly intent: string;
  readonly rules: ArenaRules;
}

const POSITION_ONLY = {
  ...NO_SHOT_LEVERS,
  rearArcHitBonus: DEFAULT_SHOT_LEVERS.rearArcHitBonus,
  rearArcDamageBonus: DEFAULT_SHOT_LEVERS.rearArcDamageBonus,
  headOnHitPenalty: DEFAULT_SHOT_LEVERS.headOnHitPenalty,
};

const MARK_ONLY = {
  ...NO_SHOT_LEVERS,
  markHitBonus: DEFAULT_SHOT_LEVERS.markHitBonus,
  markDamageBonus: DEFAULT_SHOT_LEVERS.markDamageBonus,
};

/** Every rule set the lever report measures (engine first). */
export const LEVER_CANDIDATES: readonly LeverCandidate[] = [
  {
    name: "engine",
    intent: "as shipped: position + squad mark",
    rules: ENGINE_RULES,
  },
  {
    name: "bareDice",
    intent: "no shot levers at all",
    rules: { ...ENGINE_RULES, shotLevers: NO_SHOT_LEVERS },
  },
  {
    name: "positionOnly",
    intent: "gate 1: rear arc bonus + head-on penalty",
    rules: { ...ENGINE_RULES, shotLevers: POSITION_ONLY },
  },
  {
    name: "markOnly",
    intent: "gate 2: squad mark",
    rules: { ...ENGINE_RULES, shotLevers: MARK_ONLY },
  },
  {
    name: "cadence750",
    intent: "not adopted: 1 attack / 750 ms",
    rules: { ...ENGINE_RULES, attackIntervalOverrideMs: 750 },
  },
  {
    name: "wingmanDefense",
    intent: "not adopted: -0.25 hit vs a ship with a wingman",
    rules: { ...ENGINE_RULES, wingmanDefenseHitPenalty: 0.25 },
  },
  {
    name: "suppression",
    intent: "not adopted: +0.5 stress when focus-fired",
    rules: { ...ENGINE_RULES, suppressionStress: 0.5 },
  },
];
