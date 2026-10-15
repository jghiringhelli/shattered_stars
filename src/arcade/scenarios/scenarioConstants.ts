/**
 * scenarioConstants — the numbers of the X-Wing 2.0 Scenario mode, adapted
 * from the tabletop's rounds and range ruler to the real-time battle.
 *
 * Pure data.
 */

import { CYCLE_DURATION_MS, DURABILITY_SCALE, SHIP_SIZES } from "../../config";
import { SQUAD_POINT_LIMITS } from "../../systems/SquadBuilder";

/**
 * Maneuver cycles per scenario "round" (the moment objectives score):
 * 12 cycles = 6 s.
 *
 * Why: the tabletop scores objectives once per round, and a round is one
 * attack per ship. Real time attacks every cycle, which is why ships carry
 * DURABILITY_SCALE (12) times their card's hit points — a real-time ship
 * lasts about as many 12-cycle spans as a tabletop ship lasts rounds. Scoring
 * objectives once per DURABILITY_SCALE cycles therefore keeps the tabletop's
 * balance between objective points and destruction points (with 3 s rounds,
 * measured matches were decided by objectives in 20–45 s, before the
 * fighting mattered). It is also several times the ~2–3 s a cruising ship
 * needs to cross a control zone, so only ships that deliberately hold an
 * objective score it.
 */
export const SCENARIO_ROUND_CYCLES = DURABILITY_SCALE;

/** One scenario round in battle time (ms). */
export const SCENARIO_ROUND_MS = SCENARIO_ROUND_CYCLES * CYCLE_DURATION_MS;

/** Score that wins a scenario (X-Wing 2.0: first to 20). */
export const DEFAULT_SCENARIO_THRESHOLD = 20;

/** Time limit of a scenario match (ms); the higher score wins at the bell. */
export const SCENARIO_TIME_LIMIT_MS = 300_000;

/** Range bands on the X-Wing ruler (range 1–3). */
export const X_WING_RANGE_BANDS = 3;

/**
 * One band of the OBJECTIVE ruler in px. Scenario objectives (control
 * zones, satellites, salvage) keep their tabletop proportion of the board
 * on the 6000 px battlefield, so their ruler is map-scaled; weapon ranges
 * use the combat bands (config RANGE_1–RANGE_3) in every mode instead.
 */
export const SCENARIO_RANGE_BAND_PX = 400;

/** Control range of an objective: range 0–1 (px). */
export const CONTROL_RANGE_PX = SCENARIO_RANGE_BAND_PX;

/** Radius of a salvage crate token (px). */
export const SALVAGE_TOKEN_RADIUS_PX = 16;

/**
 * Salvage pick-up reach — "range 0" (base touching the token): a large base
 * plus the token, so a bot steering at the crate cannot orbit it without
 * touching (px).
 */
export const SALVAGE_PICKUP_RADIUS_PX =
  SHIP_SIZES.large + SALVAGE_TOKEN_RADIUS_PX;

/** A ship that just dropped a crate cannot pick one up for this long (ms). */
export const SALVAGE_REPICKUP_COOLDOWN_MS = 2 * CYCLE_DURATION_MS;

/** Cycles a side must hold a network node uncontested to scramble it. */
export const SCRAMBLE_HOLD_CYCLES = 4;

/** {@link SCRAMBLE_HOLD_CYCLES} in battle time (ms). */
export const SCRAMBLE_HOLD_MS = SCRAMBLE_HOLD_CYCLES * CYCLE_DURATION_MS;

/** A ship at or below this share of hull + shields concedes half its value. */
export const HALF_POINTS_HEALTH_FRACTION = 0.5;

/**
 * Scenario points per squad point: destroying a full standard list
 * (200 squad points) is worth the whole threshold, as in X-Wing 2.0 where a
 * tabletop list totals the 20 points it plays to.
 */
export const SCENARIO_POINTS_PER_SQUAD_POINT =
  DEFAULT_SCENARIO_THRESHOLD / SQUAD_POINT_LIMITS.standard;

/** Every ship is worth at least this many scenario points. */
export const MIN_SHIP_SCENARIO_VALUE = 1;

/** Control weight of tiny and small ships. */
export const SMALL_CONTROL_WEIGHT = 1;

/** Control weight of medium and bigger ships (X-Wing 2.0: they count double). */
export const LARGE_CONTROL_WEIGHT = 2;

/**
 * Scoring knobs as one table the balance sweeps tune: control weight of
 * small and of medium-or-bigger hulls, scenario points per squad point.
 */
export const SCENARIO_TUNING = {
  smallControlWeight: SMALL_CONTROL_WEIGHT,
  largeControlWeight: LARGE_CONTROL_WEIGHT,
  pointsPerSquadPoint: SCENARIO_POINTS_PER_SQUAD_POINT,
};

/** Distance of each side's deployment line from the centre line (px). */
export const SCENARIO_DEPLOY_OFFSET_PX = 1400;

/** Spacing of ships along a deployment line (px). */
export const SCENARIO_DEPLOY_SPACING_PX = 220;
