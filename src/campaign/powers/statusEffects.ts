/**
 * statusEffects — timed effects hero powers put on ships (or on a whole
 * side): incoming-damage and attack-interval multipliers, cloak, silenced
 * weapons, time scale. An immutable ledger of entries; multipliers of
 * overlapping entries multiply. Pure.
 */

/** Kinds of timed status. */
export type StatusKind =
  | "damage_taken"
  | "attack_interval"
  | "cloaked"
  | "weapons_disabled"
  | "time_scale";

/** Ledger key of a status applied to every enemy ship. */
export const ENEMY_SIDE_KEY = "side:enemy";

/** One timed status. */
export interface StatusEntry {
  /** Ship id, or {@link ENEMY_SIDE_KEY}. */
  readonly shipId: string;
  readonly kind: StatusKind;
  readonly value: number;
  readonly untilMs: number;
}

/** Every active status. */
export type StatusLedger = readonly StatusEntry[];

/**
 * @param ledger - Ledger.
 * @param entry - Status to add.
 * @returns Ledger with it added.
 */
export function addStatus(
  ledger: StatusLedger,
  entry: StatusEntry,
): StatusLedger {
  return [...ledger, entry];
}

/**
 * @param ledger - Ledger.
 * @param key - Ship id or side key.
 * @param kind - Status kind.
 * @param nowMs - Scene time.
 * @returns Active entries for that key and kind.
 */
function active(
  ledger: StatusLedger,
  key: string,
  kind: StatusKind,
  nowMs: number,
): StatusEntry[] {
  return ledger.filter(
    (e) => e.shipId === key && e.kind === kind && e.untilMs > nowMs,
  );
}

/**
 * @param ledger - Ledger.
 * @param key - Ship id or side key.
 * @param kind - Status kind.
 * @param nowMs - Scene time.
 * @returns Product of active values (1 when none).
 */
export function statusMultiplier(
  ledger: StatusLedger,
  key: string,
  kind: StatusKind,
  nowMs: number,
): number {
  return active(ledger, key, kind, nowMs).reduce(
    (product, e) => product * e.value,
    1,
  );
}

/**
 * @param ledger - Ledger.
 * @param key - Ship id or side key.
 * @param kind - Status kind.
 * @param nowMs - Scene time.
 * @returns Whether such a status is active.
 */
export function hasStatus(
  ledger: StatusLedger,
  key: string,
  kind: StatusKind,
  nowMs: number,
): boolean {
  return active(ledger, key, kind, nowMs).length > 0;
}

/**
 * @param ledger - Ledger.
 * @param nowMs - Scene time.
 * @returns Ledger without expired entries.
 */
export function pruneStatuses(
  ledger: StatusLedger,
  nowMs: number,
): StatusLedger {
  return ledger.filter((e) => e.untilMs > nowMs);
}
