/**
 * reinforcedScenario — a scenario played as a reinforcement-pool battle.
 *
 * Classic scenarios play one 200-point list to 20 points in up to 5 minutes;
 * a destroyed ship is worth its squad cost / 10. With reinforcements each
 * side destroys several hundred points over a match, so the classic values
 * would reach the threshold on kills alone within a minute. The reinforced
 * variant:
 * - values a destroyed ship against the whole pool:
 *   {@link REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT} = 40 / 1000, so a
 *   50-point ship is worth 2 and a full pool 40;
 * - keeps the objective scoring (1 per objective per 6 s round);
 * - plays to a per-scenario threshold within the 3-minute reinforced limit,
 *   tuned on the real engine (ReinforcedBattleSim, average bots, 1000 / 250,
 *   160 matches per scenario — npm run balance:report): at 50 / 50 / 75 / 75
 *   the medians were 108 s (Satellite Array), 95 s (Chance Engagement),
 *   150 s (Salvage Mission) and 132 s (Scramble the Transmissions); score
 *   accrues about linearly, so the thresholds below put every scenario's
 *   median at ~2:30 within the 3:00 clock.
 *
 * Pure.
 */

import {
  DEFAULT_POOL_POINTS,
  REINFORCED_TIME_LIMIT_MS,
} from "../reinforcements/reinforcementRules";
import type { ScenarioDefinition } from "./scenarioDefinitions";
import type { ScenarioId } from "./scenarioTypes";

/** Scenario points a whole destroyed pool is worth. */
const POOL_WORTH = 40;

/** Scenario points per squad point: the whole pool is worth {@link POOL_WORTH}. */
export const REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT =
  POOL_WORTH / DEFAULT_POOL_POINTS;

/** Score that wins each reinforced scenario (see the measurements above). */
export const REINFORCED_SCENARIO_THRESHOLDS: Readonly<
  Record<ScenarioId, number>
> = {
  satellite_array: 70,
  chance_engagement: 75,
  salvage_mission: 75,
  scramble_transmissions: 85,
};

/**
 * @param definition - A classic scenario.
 * @returns The same scenario with the reinforced threshold, clock and values.
 */
export function reinforcedScenarioDefinition(
  definition: ScenarioDefinition,
): ScenarioDefinition {
  return {
    ...definition,
    threshold: REINFORCED_SCENARIO_THRESHOLDS[definition.id],
    timeLimitMs: REINFORCED_TIME_LIMIT_MS,
    pointsPerSquadPoint: REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT,
  };
}
