/**
 * CapitalSystems — subsystem damage model for capital-class ships.
 *
 * Inspired by X-Wing TMG's epic-ship system damage, made more precise since
 * this is a digital game: instead of a discrete crit-card draw, each of the
 * three named systems (engines/turrets/bridge) has its own continuous hull
 * pool and a weighted hit chance reflecting how exposed it is. As the ship
 * takes hull damage (after shields), hits are routed to a weighted-random
 * still-active system; when a system's pool empties it goes offline with a
 * specific gameplay effect — this is an attrition game, so capabilities are
 * meant to fall away progressively, not all at once.
 *
 * Effects when a system goes offline:
 * - engines: the ship is immobilized (dead in the water).
 * - turrets: turret damage output is halved (the inner-mounted half survives).
 * - bridge: the ship stops projecting its faction aura (loses command/support).
 */

import { random } from "../utils/random";

export type CapitalSystemId = "engines" | "turrets" | "bridge";

export interface CapitalSystemState {
  readonly id: CapitalSystemId;
  readonly hull: number;
  readonly maxHull: number;
  readonly disabled: boolean;
}

export type CapitalSystemsState = Readonly<
  Record<CapitalSystemId, CapitalSystemState>
>;

const SYSTEM_IDS: readonly CapitalSystemId[] = ["engines", "turrets", "bridge"];

/** Share of the ship's total hull assigned to each system's own pool. */
const SYSTEM_HULL_SHARE: Readonly<Record<CapitalSystemId, number>> = {
  engines: 0.25,
  turrets: 0.4,
  bridge: 0.35,
};

/** How often each system is the one a penetrating hit lands on — bridge is the most internally protected. */
const SYSTEM_HIT_WEIGHT: Readonly<Record<CapitalSystemId, number>> = {
  engines: 0.35,
  turrets: 0.45,
  bridge: 0.2,
};

/** Turret output multiplier once the turrets system is disabled. */
export const TURRET_DISABLED_MULTIPLIER = 0.5;

/** Builds fresh, fully-healthy systems sized off the ship's total hull. */
export function createCapitalSystems(totalHull: number): CapitalSystemsState {
  const build = (id: CapitalSystemId): CapitalSystemState => {
    const hull = Math.max(1, Math.round(totalHull * SYSTEM_HULL_SHARE[id]));
    return { id, hull, maxHull: hull, disabled: false };
  };
  return {
    engines: build("engines"),
    turrets: build("turrets"),
    bridge: build("bridge"),
  };
}

/** Total hull across all systems — mirrors the ship's overall hull pool. */
export function sumSystemsHull(systems: CapitalSystemsState): number {
  return SYSTEM_IDS.reduce((sum, id) => sum + systems[id].hull, 0);
}

/** Picks a still-active system, weighted by SYSTEM_HIT_WEIGHT. Null if all are disabled. */
function pickWeightedSystem(
  systems: CapitalSystemsState,
  rng: () => number,
): CapitalSystemId | null {
  const active = SYSTEM_IDS.filter((id) => !systems[id].disabled);
  if (active.length === 0) return null;
  const totalWeight = active.reduce(
    (sum, id) => sum + SYSTEM_HIT_WEIGHT[id],
    0,
  );
  let roll = rng() * totalWeight;
  for (const id of active) {
    roll -= SYSTEM_HIT_WEIGHT[id];
    if (roll <= 0) return id;
  }
  return active[active.length - 1]!;
}

export interface CapitalDamageResult {
  readonly systems: CapitalSystemsState;
  readonly hitSystemId: CapitalSystemId | null;
  /** True the instant this hit brought a system from active to disabled. */
  readonly justDisabled: boolean;
}

/** Routes post-shield damage to one weighted-random active system. */
export function applyCapitalSystemDamage(
  systems: CapitalSystemsState,
  damage: number,
  rng: () => number = random.next,
): CapitalDamageResult {
  const hitSystemId = pickWeightedSystem(systems, rng);
  if (hitSystemId === null) {
    return { systems, hitSystemId: null, justDisabled: false };
  }
  const current = systems[hitSystemId];
  const newHull = Math.max(0, current.hull - damage);
  const justDisabled = newHull <= 0 && !current.disabled;
  const updated: CapitalSystemState = {
    ...current,
    hull: newHull,
    disabled: newHull <= 0,
  };
  return {
    systems: { ...systems, [hitSystemId]: updated },
    hitSystemId,
    justDisabled,
  };
}

/** Restores hull to one system, bringing it back online if it clears 0. Used by commander repair orders. */
export function repairCapitalSystem(
  systems: CapitalSystemsState,
  id: CapitalSystemId,
  amount: number,
): CapitalSystemsState {
  const current = systems[id];
  const newHull = Math.min(current.maxHull, current.hull + amount);
  return {
    ...systems,
    [id]: { ...current, hull: newHull, disabled: newHull <= 0 },
  };
}

/** The system with the lowest remaining hull fraction — repair priority target. */
export function mostDamagedSystem(
  systems: CapitalSystemsState,
): CapitalSystemId {
  return SYSTEM_IDS.reduce((worst, id) =>
    systems[id].hull / systems[id].maxHull <
    systems[worst].hull / systems[worst].maxHull
      ? id
      : worst,
  );
}

export function isEnginesOffline(systems: CapitalSystemsState): boolean {
  return systems.engines.disabled;
}

export function isBridgeOffline(systems: CapitalSystemsState): boolean {
  return systems.bridge.disabled;
}

/** Turrets lose half their output when disabled — the inner-mounted half survives. */
export function turretDamageMultiplier(systems: CapitalSystemsState): number {
  return systems.turrets.disabled ? TURRET_DISABLED_MULTIPLIER : 1;
}

/** Human-readable label for HUD/combat log messages. */
export const SYSTEM_LABELS: Readonly<Record<CapitalSystemId, string>> = {
  engines: "ENGINES",
  turrets: "TURRETS",
  bridge: "BRIDGE",
};
