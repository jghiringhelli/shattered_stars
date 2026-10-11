/**
 * RepairEvents — the repair event vocabulary shared by scenes (producers),
 * the per-ship overlay and the repair-drone VFX (consumers).
 *
 * A repair event says WHO was restored (ship id), WHAT (hull or shield), by
 * HOW MUCH (real-time HP) and WHERE it came from (the ship's own astromech /
 * crew / shield regen, or an allied ship's repair field). Pure, no Phaser.
 */

import { GameError } from "../../../core/errors";

/** What a repair restored. */
export type RepairKind = "hull" | "shield";

/**
 * Where a repair came from.
 * - `astromech`: the ship's own droid (shield regen or hull patching).
 * - `mechanic_crew`: the ship's own mechanic crew patching hull.
 * - `self_regen`: the ship's own shield regeneration (talent, ability, mod).
 * - `aura`: an allied support/capital ship's repair field (needs a source ship).
 * - `damage_control`: a capital's commander repair order (repair crews).
 */
export type RepairSourceKind =
  "astromech" | "mechanic_crew" | "self_regen" | "aura" | "damage_control";

/** A known repair source: its kind and the ally that sent it (if any). */
export interface RepairSource {
  readonly kind: RepairSourceKind;
  /** The allied ship projecting the repair, or null for self-repair. */
  readonly sourceShipId: string | null;
}

/** One repair delivered to one ship. */
export interface RepairEvent {
  readonly shipId: string;
  readonly kind: RepairKind;
  /** Real-time HP restored (always > 0). */
  readonly amount: number;
  readonly sourceShipId: string | null;
  readonly sourceKind: RepairSourceKind;
}

/** Hull and shields at one instant. */
export interface DurabilitySnapshot {
  readonly hull: number;
  readonly shields: number;
}

/** A ship's durability before and after a repair step, with its source. */
export interface RepairObservation {
  readonly shipId: string;
  readonly previous: DurabilitySnapshot;
  readonly current: DurabilitySnapshot;
  /** Source of restored shields (and of hull unless `hullSource` is given). */
  readonly source: RepairSource;
  /** Source of restored hull, when it differs from the shield source. */
  readonly hullSource?: RepairSource;
}

/** Gains smaller than this are float noise, not repair. */
export const MIN_REPAIR_AMOUNT = 1e-6;

/** Raised when a repair names an impossible source. */
export class RepairEventError extends GameError {
  /**
   * @param message - What is wrong.
   * @param context - The offending ship and source.
   */
  constructor(message: string, context: Record<string, unknown>) {
    super(message, "REPAIR_INVALID_SOURCE", "COMBAT", "error", context);
    this.name = "RepairEventError";
  }
}

/**
 * Validate a source: an aura repair must name the projecting ship.
 * @param shipId - The repaired ship.
 * @param source - The claimed source.
 */
function assertValidSource(shipId: string, source: RepairSource): void {
  if (source.kind === "aura" && source.sourceShipId === null) {
    throw new RepairEventError("Aura repair without a source ship", {
      shipId,
      sourceKind: source.kind,
    });
  }
}

/**
 * Build one event, or null when the gain is not a repair.
 * @param shipId - The repaired ship.
 * @param kind - Hull or shield.
 * @param gain - Real-time HP gained (may be ≤ 0).
 * @param source - Where it came from.
 * @returns The event, or null.
 */
function eventFor(
  shipId: string,
  kind: RepairKind,
  gain: number,
  source: RepairSource,
): RepairEvent | null {
  if (gain < MIN_REPAIR_AMOUNT) return null;
  assertValidSource(shipId, source);
  return {
    shipId,
    kind,
    amount: gain,
    sourceShipId: source.sourceShipId,
    sourceKind: source.kind,
  };
}

/**
 * The repairs implied by a ship's durability going from `previous` to
 * `current`: at most one shield event then one hull event. Losses are
 * damage, not repair, and yield nothing.
 *
 * @param observation - Before/after values and the known source(s).
 * @returns Zero, one or two repair events (shield first).
 * @throws RepairEventError when an aura repair names no source ship.
 */
export function detectRepairs(observation: RepairObservation): RepairEvent[] {
  const { shipId, previous, current, source } = observation;
  const events: RepairEvent[] = [];
  const shield = eventFor(
    shipId,
    "shield",
    current.shields - previous.shields,
    source,
  );
  if (shield) events.push(shield);
  const hull = eventFor(
    shipId,
    "hull",
    current.hull - previous.hull,
    observation.hullSource ?? source,
  );
  if (hull) events.push(hull);
  return events;
}
