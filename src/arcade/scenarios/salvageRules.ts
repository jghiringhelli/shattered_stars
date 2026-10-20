/**
 * salvageRules — tabletop "Salvage Mission" for both sides, in real time:
 * an unstressed ship not already carrying, at range 0 of a loose crate,
 * picks it up (nearest eligible ship first; an exact tie between the sides
 * goes to the side carrying fewer crates, else waits a frame); a carried
 * crate follows its carrier; a boost or barrel roll drops it where the
 * action started and destruction drops it at the wreck. A ship that just
 * dropped a crate waits
 * {@link SALVAGE_REPICKUP_COOLDOWN_MS} before it can pick one up again.
 *
 * The mission objectives' SALVAGE_MODEL is player-only and delivers crates
 * to a drop zone; the scenario needs both sides carrying (and scoring per
 * round), so this composes the same geometry instead.
 *
 * Pure.
 */

import {
  distanceBetween,
  type ObjectivePoint,
} from "../objectives/objectiveGeometry";
import {
  SALVAGE_PICKUP_RADIUS_PX,
  SALVAGE_REPICKUP_COOLDOWN_MS,
} from "./scenarioConstants";
import type {
  SalvageCrate,
  ScenarioFrame,
  ScenarioShip,
  ScenarioSide,
} from "./scenarioTypes";

/** Distance difference (px) under which two ships reach a crate together. */
const PICKUP_TIE_PX = 1e-6;

/** One salvage step's input. */
export interface SalvageStepInput {
  readonly crates: readonly SalvageCrate[];
  /** Ship id → battle time (ms) until which it cannot pick up. */
  readonly cooldowns: ReadonlyMap<string, number>;
  readonly frame: ScenarioFrame;
  /** Battle time (ms). */
  readonly nowMs: number;
}

/** One salvage step's output. */
export interface SalvageStepResult {
  readonly crates: SalvageCrate[];
  readonly cooldowns: ReadonlyMap<string, number>;
}

/**
 * @param slots - Where the crates lie and their labels.
 * @returns Loose crates.
 */
export function createCrates(
  slots: readonly (ObjectivePoint & { readonly label: string })[],
): SalvageCrate[] {
  return slots.map((slot, i) => ({
    id: `crate_${i}`,
    label: slot.label,
    x: slot.x,
    y: slot.y,
    carrierId: null,
    carrierSide: null,
  }));
}

/**
 * Follow carriers, drop on evasion / destruction, then pick up.
 *
 * @param input - Crates, cooldowns, the frame and the time.
 * @returns Crates and cooldowns after this frame.
 */
export function stepSalvage(input: SalvageStepInput): SalvageStepResult {
  const cooldowns = new Map(input.cooldowns);
  for (const [id, until] of cooldowns) {
    if (until <= input.nowMs) cooldowns.delete(id);
  }
  const moved = input.crates.map((crate) =>
    followOrDrop(crate, input.frame, input.nowMs, cooldowns),
  );
  return { crates: pickUp(moved, input.frame, cooldowns), cooldowns };
}

/**
 * @param crates - Crates.
 * @param side - A side.
 * @returns How many crates the side's ships carry.
 */
export function cratesCarriedBy(
  crates: readonly SalvageCrate[],
  side: ScenarioSide,
): number {
  return crates.filter((crate) => crate.carrierSide === side).length;
}

/**
 * @param crate - A crate.
 * @param frame - This frame.
 * @param nowMs - Battle time.
 * @param cooldowns - Pick-up cooldowns (a dropper is added).
 * @returns The crate after its carrier moved, evaded or died.
 */
function followOrDrop(
  crate: SalvageCrate,
  frame: ScenarioFrame,
  nowMs: number,
  cooldowns: Map<string, number>,
): SalvageCrate {
  const carrierId = crate.carrierId;
  if (!carrierId) return crate;
  const dropAt =
    frame.events.find(
      (e) =>
        (e.kind === "evasive" || e.kind === "destroyed") &&
        e.shipId === carrierId,
    ) ?? null;
  if (dropAt) {
    cooldowns.set(carrierId, nowMs + SALVAGE_REPICKUP_COOLDOWN_MS);
    return loose(crate, dropAt);
  }
  const carrier = frame.ships.find((ship) => ship.id === carrierId);
  return carrier
    ? { ...crate, x: carrier.x, y: carrier.y }
    : loose(crate, crate);
}

/**
 * @param crate - A crate.
 * @param at - Where it falls.
 * @returns It loose at that point.
 */
function loose(crate: SalvageCrate, at: ObjectivePoint): SalvageCrate {
  return { ...crate, x: at.x, y: at.y, carrierId: null, carrierSide: null };
}

/**
 * @param crates - Crates after carriers moved.
 * @param frame - This frame.
 * @param cooldowns - Pick-up cooldowns.
 * @returns Crates after eligible ships picked loose ones up.
 */
function pickUp(
  crates: readonly SalvageCrate[],
  frame: ScenarioFrame,
  cooldowns: ReadonlyMap<string, number>,
): SalvageCrate[] {
  const carrying = new Set(
    crates.map((c) => c.carrierId).filter((id): id is string => id !== null),
  );
  const evading = new Set(
    frame.events.filter((e) => e.kind === "evasive").map((e) => e.shipId),
  );
  const eligible = (ship: ScenarioShip): boolean =>
    !ship.stressed &&
    !carrying.has(ship.id) &&
    !evading.has(ship.id) &&
    !cooldowns.has(ship.id);
  return crates.map((crate) => {
    if (crate.carrierId) return crate;
    const picker = pickerFor(
      crate,
      frame.ships.filter(eligible),
      frame.worldSize,
      (side) => cratesCarriedBy(crates, side),
    );
    if (!picker) return crate;
    carrying.add(picker.id);
    return {
      ...crate,
      x: picker.x,
      y: picker.y,
      carrierId: picker.id,
      carrierSide: picker.side,
    };
  });
}

/**
 * Who picks a loose crate up: the nearest eligible ship at range 0. Ships of
 * both sides equally near (a mirrored approach — the two flagships reach
 * the centre crate on the same frame) are a tie, never settled by list
 * order (the later side took the centre crate in every reinforced Salvage
 * Mission and won 79 % of them): the side carrying fewer crates takes it;
 * still even, nobody does this frame.
 *
 * @param at - A crate.
 * @param ships - Eligible ships.
 * @param worldSize - Torus side.
 * @param carriedBy - Crates a side carries now.
 * @returns The ship that picks it up, or null.
 */
function pickerFor(
  at: ObjectivePoint,
  ships: readonly ScenarioShip[],
  worldSize: number,
  carriedBy: (side: ScenarioSide) => number,
): ScenarioShip | null {
  const player = nearestWithin(
    at,
    ships.filter((s) => s.side === "player"),
    worldSize,
  );
  const enemy = nearestWithin(
    at,
    ships.filter((s) => s.side === "enemy"),
    worldSize,
  );
  if (!player || !enemy) return player ?? enemy;
  const gap =
    distanceBetween(player, at, worldSize) -
    distanceBetween(enemy, at, worldSize);
  if (Math.abs(gap) > PICKUP_TIE_PX) return gap < 0 ? player : enemy;
  const lead = carriedBy("player") - carriedBy("enemy");
  return lead === 0 ? null : lead < 0 ? player : enemy;
}

/**
 * @param at - A crate.
 * @param ships - Candidate ships.
 * @param worldSize - Torus side.
 * @returns The nearest ship at range 0, or null.
 */
function nearestWithin(
  at: ObjectivePoint,
  ships: readonly ScenarioShip[],
  worldSize: number,
): ScenarioShip | null {
  let best: ScenarioShip | null = null;
  let bestDistance = SALVAGE_PICKUP_RADIUS_PX;
  for (const ship of ships) {
    const distance = distanceBetween(ship, at, worldSize);
    if (distance <= bestDistance) {
      best = ship;
      bestDistance = distance;
    }
  }
  return best;
}
