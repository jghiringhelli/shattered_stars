/**
 * Survival roguelite — milestone Hangar (pure). Every 5th level opens a choice
 * to graduate the hull ("saltar"), add an escort, or evolve the current hull.
 * See ADR-0003.
 */

import {
  type HullClass,
  type SurvivalRunState,
  HULL_BRANCH_BIAS,
} from "./model";

export type HangarKind = "graduate" | "escort" | "evolve";

export interface HangarOption {
  kind: HangarKind;
  hull?: HullClass;
  name: string;
  description: string;
  icon: string;
}

/**
 * Adjacency for graduation: guided-but-not-rigid lanes so the ace line and the
 * carrier line diverge rather than everyone converging on the capital hull.
 */
export const GRADUATION: Readonly<Record<HullClass, readonly HullClass[]>> = {
  workhorse: ["ace", "gunboat"],
  ace: ["gunboat", "capital"],
  gunboat: ["carrier", "capital"],
  carrier: ["capital"],
  capital: [],
};

const HULL_LABEL: Readonly<Record<HullClass, string>> = {
  workhorse: "Workhorse",
  ace: "Ace",
  gunboat: "Gunboat",
  carrier: "Carrier",
  capital: "Capital",
};

/** Milestone options: graduation lanes plus escort and evolve. */
export function hangarOptions(state: SurvivalRunState): HangarOption[] {
  const options: HangarOption[] = GRADUATION[state.hull].map((hull) => ({
    kind: "graduate",
    hull,
    name: `Saltar: ${HULL_LABEL[hull]}`,
    description: `Graduate to a ${HULL_LABEL[hull]} hull (amplifies ${HULL_BRANCH_BIAS[hull].join(" + ")})`,
    icon: "🚁",
  }));
  options.push({
    kind: "escort",
    name: "Escort Wing",
    description: "Add an AI escort to your fleet",
    icon: "🛩️",
  });
  options.push({
    kind: "evolve",
    name: "Evolve Hull",
    description: `Deepen your ${HULL_LABEL[state.hull]} (${HULL_BRANCH_BIAS[state.hull].join(" + ")})`,
    icon: "🧬",
  });
  return options;
}

/** Switches the flagship hull; future draws are amplified by the new hull. */
export function applyGraduate(
  state: SurvivalRunState,
  hull: HullClass,
): SurvivalRunState {
  if (!GRADUATION[state.hull].includes(hull)) return state;
  state.hull = hull;
  return state;
}

/** Deepens investment in the current hull's two amplified branches. */
export function applyEvolve(state: SurvivalRunState): SurvivalRunState {
  for (const branch of HULL_BRANCH_BIAS[state.hull]) {
    state.branch[branch] += 1;
  }
  return state;
}

/** Adds an escort to the fleet. */
export function applyEscort(state: SurvivalRunState): SurvivalRunState {
  state.escorts += 1;
  return state;
}
