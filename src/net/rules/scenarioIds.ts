/**
 * The scenarios an online room may run. A plain list so the relay needs none
 * of the scenario rules code; a unit test keeps it equal to
 * `SCENARIO_IDS` in src/arcade/scenarios.
 */
export const ONLINE_SCENARIO_IDS: readonly string[] = [
  "satellite_array",
  "chance_engagement",
  "salvage_mission",
  "scramble_transmissions",
];

/** @param id - Anything. @returns Whether it names an online scenario. */
export function isOnlineScenarioId(id: unknown): id is string {
  return typeof id === "string" && ONLINE_SCENARIO_IDS.includes(id);
}
