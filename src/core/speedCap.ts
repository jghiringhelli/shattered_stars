/**
 * Speed cap per maneuver — the dial decides at which speeds a maneuver
 * exists, so a ship cannot fly a bank, turn or special faster than its own
 * dial prints it. The throttle stays a discrete SET speed (↑/↓ notches);
 * at every cycle boundary the FLOWN speed of the committed maneuver is
 * derived from it, and the next straight cycle returns to the set speed.
 *
 * Rule ({@link flownSpeed}): the highest dial speed of that maneuver at or
 * below the set speed; when the dial prints it only above the set speed
 * (a Snap turn that exists at 3 only, set speed 2) the nearest printed one.
 * Speed 0 (hover, ships with a minimum of 0) is never lifted: the ship pivots in place.
 * Straight also keeps the set speed above the dial (the upgrade notch).
 * Drift (the held-key shallow turn, not on the dial) uses the bank entries.
 * A maneuver the dial does not print at all, and ships without a table
 * (huge hulls, legacy states), are not capped.
 *
 * Pure and serialisable: the table is plain data carried by the control state.
 */

import type { ManeuverDefinition, ManeuverDirection } from "./types";

/** Maneuvers that share dial entries (left/right, bank/drift). */
export type CapGroup =
  "straight" | "bank" | "turn" | "kturn" | "segnor" | "tallon";

/** Ascending dial speeds of each maneuver group; absent = not on the dial. */
export type DialSpeedTable = Readonly<
  Partial<Record<CapGroup, readonly number[]>>
>;

/**
 * @param direction - Any maneuver the engine flies.
 * @returns The dial group whose speeds cap it (drift flies on the bank entries).
 */
export function capGroupOf(direction: ManeuverDirection): CapGroup {
  if (direction === "straight") return "straight";
  if (direction === "kturn") return "kturn";
  if (direction.startsWith("bank") || direction.startsWith("drift"))
    return "bank";
  if (direction.startsWith("turn")) return "turn";
  if (direction.startsWith("segnor")) return "segnor";
  return "tallon";
}

/**
 * @param dial - A ship's dial (as it flies, after the trick rule).
 * @returns The speeds the dial prints for each maneuver group, ascending.
 */
export function dialSpeedTable(
  dial: readonly ManeuverDefinition[],
): DialSpeedTable {
  const speeds: Partial<Record<CapGroup, number[]>> = {};
  for (const entry of dial) {
    const group = capGroupOf(entry.direction);
    const known = speeds[group] ?? [];
    if (!known.includes(entry.speed)) known.push(entry.speed);
    speeds[group] = known;
  }
  const table: Partial<Record<CapGroup, readonly number[]>> = {};
  for (const [group, list] of Object.entries(speeds))
    table[group as CapGroup] = list.sort((a, b) => a - b);
  return table;
}

/**
 * @param table - The ship's dial speeds (undefined = no cap).
 * @param direction - The maneuver being committed.
 * @returns The highest speed the dial prints for it, or null when uncapped.
 */
export function maneuverSpeedCap(
  table: DialSpeedTable | undefined,
  direction: ManeuverDirection,
): number | null {
  const speeds = table?.[capGroupOf(direction)];
  return speeds && speeds.length > 0 ? speeds[speeds.length - 1]! : null;
}

/**
 * The speed a cycle of `direction` is flown at.
 *
 * @param table - The ship's dial speeds (undefined = no cap).
 * @param direction - The maneuver being committed.
 * @param setSpeed - The throttle the pilot set.
 * @returns min(set, cap): the highest printed speed at or below the set speed,
 * else the nearest printed one; the set speed when uncapped. Straight above
 * the dial's top (an upgrade notch) is not capped.
 */
export function flownSpeed(
  table: DialSpeedTable | undefined,
  direction: ManeuverDirection,
  setSpeed: number,
): number {
  const speeds = table?.[capGroupOf(direction)];
  if (!speeds || speeds.length === 0 || setSpeed <= 0) return setSpeed;
  // Above the dial, straight is an upgrade notch: never capped.
  if (direction === "straight" && setSpeed > speeds[speeds.length - 1]!)
    return setSpeed;
  let best: number | null = null;
  for (const speed of speeds) if (speed <= setSpeed) best = speed;
  return best ?? speeds[0]!;
}

/** What the queued-maneuver previews read of a control state. */
export interface QueuedSpeedView {
  readonly speed: number;
  readonly nextManeuver: ManeuverDirection | null;
  readonly capabilities?:
    { readonly dialSpeeds?: DialSpeedTable | undefined } | undefined;
}

/**
 * @param control - Control state.
 * @returns The speed the maneuver queued for the next cycle (straight when
 * none) will be flown at: what the HUD previews while a steering key is held.
 */
export function queuedCycleSpeed(control: QueuedSpeedView): number {
  return flownSpeed(
    control.capabilities?.dialSpeeds,
    control.nextManeuver ?? "straight",
    control.speed,
  );
}

/**
 * @param control - Control state.
 * @returns The dial cap of the maneuver queued for the next cycle (straight
 * when none), or null when uncapped.
 */
export function queuedSpeedCap(control: QueuedSpeedView): number | null {
  return maneuverSpeedCap(
    control.capabilities?.dialSpeeds,
    control.nextManeuver ?? "straight",
  );
}
