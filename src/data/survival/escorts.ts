/**
 * Survival roguelite — escort model (pure, seedable, no I/O).
 *
 * Escorts are a SECOND, parallel progression to the power draft. In the
 * roguelite run (ADR-0004) escorts are hired in shops, won in events, granted
 * by Wing Commander and meta escort packages; the per-wave escort-track
 * choice below remains the endless model the balance sim's draft policy
 * drives.
 *
 * Design intent (ADR-0003): escorts are weak, basic, cheap faction ships. Their
 * QUANTITY comes from recruitment; their QUALITY comes from support investment
 * (the fleet branch and the carrier hull), never from the escort pick itself.
 * Without support, stacking escorts yields diminishing returns instead of the
 * old runaway where every escort was a full copy of the flagship.
 */

import { type SurvivalRunState } from "./model";

/** Max escorts a run may field (flagship + escorts stays within the fleet cap). */
export const MAX_ESCORTS = 5;

/** Combat-power contribution of one basic, unsupported escort. */
export const ESCORT_UNIT_POWER = 2;

/** Each point of fleet-branch depth adds this to the escort quality multiplier. */
export const ESCORT_FLEET_SCALE = 0.25;

/** The carrier hull adds this flat bonus to the escort quality multiplier. */
export const ESCORT_CARRIER_BONUS = 0.75;

export type EscortKind = "recruit" | "bank";

export interface EscortOption {
  kind: EscortKind;
  name: string;
  description: string;
  icon: string;
}

/**
 * Support-investment multiplier that scales escort quality.
 * @param state - The run state (reads fleet branch depth and hull).
 * @returns A multiplier &gt;= 1; higher with fleet investment / carrier hull.
 */
export function escortQualityMultiplier(
  state: Readonly<SurvivalRunState>,
): number {
  const carrier = state.hull === "carrier" ? ESCORT_CARRIER_BONUS : 0;
  return 1 + state.branch.fleet * ESCORT_FLEET_SCALE + carrier;
}

/**
 * Combat power the escort wing contributes — weak unless support-invested.
 * @param state - The run state (reads escort count and support investment).
 * @returns Total escort-wing power (0 when there are no escorts).
 */
export function escortFleetPower(state: Readonly<SurvivalRunState>): number {
  const escorts = Math.min(state.escorts, MAX_ESCORTS);
  return escorts * ESCORT_UNIT_POWER * escortQualityMultiplier(state);
}

/**
 * The parallel escort-track choice offered each wave.
 * @param state - The run state (recruit is withheld once the wing is at cap).
 * @returns The available escort-track options (always at least one).
 */
export function escortOptions(
  state: Readonly<SurvivalRunState>,
): EscortOption[] {
  const options: EscortOption[] = [];
  if (state.escorts < MAX_ESCORTS) {
    options.push({
      kind: "recruit",
      name: "Recruit Escort",
      description: "Add a basic AI escort (quality scales with fleet support)",
      icon: "🛩️",
    });
  }
  options.push({
    kind: "bank",
    name: "Hold Formation",
    description: "Bank a reroll charge for a future draft",
    icon: "🎲",
  });
  return options;
}

/**
 * Applies the chosen escort-track option.
 * @param state - The run state to mutate.
 * @param option - The chosen escort-track option.
 * @returns The same, mutated state (for chaining).
 */
export function applyEscortOption(
  state: SurvivalRunState,
  option: EscortOption,
): SurvivalRunState {
  if (option.kind === "recruit" && state.escorts < MAX_ESCORTS) {
    state.escorts += 1;
  } else if (option.kind === "bank") {
    state.rerolls += 1;
  }
  return state;
}
