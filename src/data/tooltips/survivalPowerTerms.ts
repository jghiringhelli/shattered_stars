/**
 * SURVIVAL_POWER_TERMS - tooltip terms of the Survival power draft: the six
 * power branches, the three power tiers and the hangar / mutation rewards.
 * Typed against the power model so a new branch fails tsc until explained.
 * Pure data.
 */

import type { Branch } from "../survival/model";
import type { PowerTier } from "../survival/powers";
import { term, type TermEntry } from "./termTypes";

const BRANCH_TERMS: Readonly<Record<`survival.branch.${Branch}`, TermEntry>> = {
  "survival.branch.gunnery": term(
    "Branch: gunnery",
    "Powers that improve your guns: damage, crit chance, range and fire rate.",
    "Cannon Calibration: +1 primary damage. Marksman's Focus (5 gunnery powers): +3 primary damage.",
    "Depth in one branch unlocks its capstone: stack the branch your hull already amplifies.",
  ),
  "survival.branch.ordnance": term(
    "Branch: ordnance",
    "Powers that improve primary damage, range and fire rate with a heavy-weapon flavour.",
    "Warhead Yield: +1 primary damage. Barrage Doctrine (capstone): +3 primary damage.",
  ),
  "survival.branch.automation": term(
    "Branch: automation",
    "Powers for turrets, drones and automated defence: fire rate, range, point defence.",
    "Servo Turrets: +10 % fire rate. Swarm Logic (capstone): +30 % fire rate.",
  ),
  "survival.branch.fleet": term(
    "Branch: fleet",
    "Powers that make the whole fleet (flagship and escorts) harder to kill or faster.",
    "Screening Wing: +1 evasion for the fleet. Admiral's Command (capstone): +3 evasion.",
  ),
  "survival.branch.bulwark": term(
    "Branch: bulwark",
    "Powers for survivability: hull, shields and shield regeneration.",
    "Hull Plating: +2 max hull. Fortress Hull (capstone): +6 max hull.",
  ),
  "survival.branch.drive": term(
    "Branch: drive",
    "Powers for speed, boost and evasion. Also home to the Nav Computer reroll.",
    "Thruster Tuning: +1 drive, a top-speed notch. Afterburners (capstone): +3 drive.",
  ),
};

const TIER_TERMS: Readonly<Record<`survival.tier.${PowerTier}`, TermEntry>> = {
  "survival.tier.atom": term(
    "Tier: atom",
    "A small permanent bonus. Atoms fill a branch; the deeper the branch, the better powers the draft offers.",
    "Cannon Calibration (+1 primary damage) is an atom of the gunnery branch.",
    "Every battle node offers a draft: take atoms in one branch to reach its capstone.",
  ),
  "survival.tier.capstone": term(
    "Tier: capstone",
    "A big bonus that appears only after you own 5 powers of one branch.",
    "Marksman's Focus: +3 primary damage, offered once gunnery reaches depth 5.",
    "Plan your drafts: a capstone is worth several atoms.",
  ),
  "survival.tier.cross": term(
    "Tier: cross",
    "A combo power that appears once two different branches both reach depth 3.",
    "Alpha Strike needs gunnery and ordnance at depth 3 each.",
    "Splitting evenly between two branches can beat going deep in one.",
  ),
};

/** Terms of the power draft. */
export const SURVIVAL_POWER_TERMS = {
  ...BRANCH_TERMS,
  ...TIER_TERMS,
  "survival.hangar": term(
    "Hangar",
    "A reward node: graduate to a heavier hull class (it amplifies two power branches) or evolve the hull you fly.",
    "Graduate to the hull that amplifies the branches you have been drafting: amplified branches give 1.5x their stat bonus.",
  ),
  "survival.mutation": term(
    "Mutation",
    "A permanent behaviour change for one slot of your flagship (weapon or systems). Options in a slot exclude each other.",
    "A weapon mutation changes how your primary guns fire for the rest of the run.",
    "Read both options: the choice is a trade, not a plain upgrade.",
  ),
} as const;
