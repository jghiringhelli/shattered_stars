/**
 * Survival roguelite — draft policies (pure, no Phaser, no I/O).
 *
 * A policy models how a *player archetype* drafts: which power it takes from an
 * offered set and which Hangar option it picks at a milestone. Policies let the
 * headless balance sim explore build space (specialist vs generalist vs brawler
 * vs random) so ADR-0003 coefficients can be tuned against real strategies.
 *
 * See docs/adr/ADR-0003-survival-roguelite-leveling.md.
 */

import type { RandomGenerator } from "../utils/random";
import {
  type Branch,
  type StatBonuses,
  type SurvivalRunState,
  BRANCHES,
} from "../data/survival/model";
import type { Power } from "../data/survival/powers";
import type { HangarOption } from "../data/survival/hangar";

/** A drafting strategy: chooses one power and one Hangar option per prompt. */
export interface DraftPolicy {
  readonly name: string;
  pickPower(
    offered: readonly Power[],
    state: Readonly<SurvivalRunState>,
  ): Power;
  pickHangar(
    options: readonly HangarOption[],
    state: Readonly<SurvivalRunState>,
  ): HangarOption;
}

/** Stats that make a fleet tankier rather than deadlier. */
const DURABILITY_STATS: ReadonlySet<keyof StatBonuses> = new Set([
  "maxHull",
  "maxShields",
  "shieldRegen",
  "evasion",
]);

/** Deterministic tiebreak: earlier branch in BRANCHES wins. */
function branchOrder(branch: Branch): number {
  return BRANCHES.indexOf(branch);
}

/** Non-atom powers (capstone / cross) are the deliberate spikes. */
function isSpike(power: Power): boolean {
  return power.tier !== "atom";
}

/** Picks the offered element maximising `score`, tiebroken by `tiebreak` (lower wins). */
function argmax<T>(
  items: readonly T[],
  score: (item: T) => number,
  tiebreak: (item: T) => number,
): T {
  let best = items[0]!;
  let bestScore = score(best);
  let bestTie = tiebreak(best);
  for (let i = 1; i < items.length; i++) {
    const item = items[i]!;
    const s = score(item);
    if (s > bestScore || (s === bestScore && tiebreak(item) < bestTie)) {
      best = item;
      bestScore = s;
      bestTie = tiebreak(item);
    }
  }
  return best;
}

/**
 * Specialist: pours investment into whichever branch is already deepest and
 * always grabs a spike (capstone/cross) when offered. Hangar → evolve (deepen).
 */
export function specialistPolicy(): DraftPolicy {
  return {
    name: "specialist",
    pickPower(offered, state) {
      return argmax(
        offered,
        (p) => state.branch[p.branch] * 10 + (isSpike(p) ? 5 : 0),
        (p) => branchOrder(p.branch),
      );
    },
    pickHangar(options) {
      return options.find((o) => o.kind === "evolve") ?? options[0]!;
    },
  };
}

/**
 * Generalist: spreads into the shallowest branch to unlock cross powers. Hangar
 * → graduate (change hull) to re-bias branches, else evolve.
 */
export function generalistPolicy(): DraftPolicy {
  return {
    name: "generalist",
    pickPower(offered, state) {
      return argmax(
        offered,
        (p) => -state.branch[p.branch] + (isSpike(p) ? 100 : 0),
        (p) => branchOrder(p.branch),
      );
    },
    pickHangar(options) {
      return (
        options.find((o) => o.kind === "graduate") ??
        options.find((o) => o.kind === "evolve") ??
        options[0]!
      );
    },
  };
}

/**
 * Brawler: prioritises durability stats and the bulwark/fleet branches, favours
 * more hulls. Hangar → escort (add a ship).
 */
export function brawlerPolicy(): DraftPolicy {
  return {
    name: "brawler",
    pickPower(offered, state) {
      return argmax(
        offered,
        (p) => {
          const durable = p.stat && DURABILITY_STATS.has(p.stat) ? 20 : 0;
          const branchBias =
            p.branch === "bulwark" || p.branch === "fleet" ? 5 : 0;
          return (
            durable +
            branchBias +
            state.branch[p.branch] +
            (isSpike(p) ? 10 : 0)
          );
        },
        (p) => branchOrder(p.branch),
      );
    },
    pickHangar(options) {
      return options.find((o) => o.kind === "escort") ?? options[0]!;
    },
  };
}

/** Random: uniform pick from what is offered (baseline / control). */
export function randomPolicy(rng: RandomGenerator): DraftPolicy {
  return {
    name: "random",
    pickPower(offered) {
      return rng.pick([...offered]) ?? offered[0]!;
    },
    pickHangar(options) {
      return rng.pick([...options]) ?? options[0]!;
    },
  };
}

/** The four reference archetypes the balance sim sweeps. */
export function allPolicies(rng: RandomGenerator): DraftPolicy[] {
  return [
    specialistPolicy(),
    generalistPolicy(),
    brawlerPolicy(),
    randomPolicy(rng),
  ];
}
