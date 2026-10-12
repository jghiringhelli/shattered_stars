/**
 * RebindableIntents — which intents the player may rebind on the keyboard,
 * how they are labelled in Settings, and the input contexts each is live in.
 *
 * Contexts decide conflicts: two intents may share a key only when no scene
 * listens to both (e.g. ↑ is both tactical PAN_UP and flight THRUST_UP).
 */

import type { ActionIntent } from "./InputTypes";

/** Where an intent is listened to. */
export type BindingContext = "flight" | "tactical" | "menu";

/** Settings section an intent is listed under. */
export type RebindGroup = "flight" | "combat" | "system";

/** One rebindable row. */
export interface RebindableIntent {
  readonly intent: ActionIntent;
  readonly label: string;
  readonly group: RebindGroup;
}

/** Every keyboard-rebindable intent, in Settings display order. */
export const REBINDABLE_INTENTS: readonly RebindableIntent[] = [
  { intent: "STEER_LEFT", label: "Steer Left", group: "flight" },
  { intent: "STEER_RIGHT", label: "Steer Right", group: "flight" },
  { intent: "THRUST_UP", label: "Throttle Up", group: "flight" },
  { intent: "THRUST_DOWN", label: "Throttle Down", group: "flight" },
  { intent: "KTURN", label: "K-Turn", group: "flight" },
  { intent: "SHARP_TURN_LEFT", label: "Hard Turn Left", group: "flight" },
  { intent: "SHARP_TURN_RIGHT", label: "Hard Turn Right", group: "flight" },
  { intent: "SEGNOR_LEFT", label: "Segnor Loop Left", group: "flight" },
  { intent: "SEGNOR_RIGHT", label: "Segnor Loop Right", group: "flight" },
  { intent: "TALLON_LEFT", label: "Tallon Roll Left", group: "flight" },
  { intent: "TALLON_RIGHT", label: "Tallon Roll Right", group: "flight" },
  { intent: "BARREL_ROLL_LEFT", label: "Barrel Roll Left", group: "flight" },
  { intent: "BARREL_ROLL_RIGHT", label: "Barrel Roll Right", group: "flight" },
  { intent: "BOOST", label: "Boost (extra key)", group: "flight" },
  { intent: "FIRE_SECONDARY", label: "Fire Secondary", group: "combat" },
  { intent: "WEAPON_CYCLE", label: "Cycle Weapon", group: "combat" },
  { intent: "MARK_TARGET", label: "Mark Target", group: "combat" },
  { intent: "HERO_POWER_1", label: "Hero Power 1", group: "combat" },
  { intent: "HERO_POWER_2", label: "Hero Power 2", group: "combat" },
  { intent: "CLOAK", label: "Cloak", group: "combat" },
  { intent: "CREW_CYCLE", label: "Cycle Crew Role", group: "combat" },
  { intent: "COMMANDER_ORDER_1", label: "Commander Order 1", group: "combat" },
  { intent: "COMMANDER_ORDER_2", label: "Commander Order 2", group: "combat" },
  { intent: "COMMANDER_ORDER_3", label: "Commander Order 3", group: "combat" },
  { intent: "COMMANDER_ORDER_4", label: "Commander Order 4", group: "combat" },
  { intent: "PAUSE", label: "Pause", group: "system" },
];

const REBINDABLE_SET: ReadonlySet<string> = new Set(
  REBINDABLE_INTENTS.map((r) => r.intent),
);

/**
 * @param intent - Any string (e.g. read from storage).
 * @returns Whether it names a rebindable intent.
 */
export function isRebindableIntent(intent: string): intent is ActionIntent {
  return REBINDABLE_SET.has(intent);
}

const FLIGHT: readonly BindingContext[] = ["flight"];
const TACTICAL: readonly BindingContext[] = ["tactical"];
const BOTH: readonly BindingContext[] = ["flight", "tactical"];
const MENU: readonly BindingContext[] = ["menu"];

/** Intents that are not flight-only. Everything unlisted is flight-only. */
const NON_FLIGHT_CONTEXTS: Partial<
  Record<ActionIntent, readonly BindingContext[]>
> = {
  PAN_UP: TACTICAL,
  PAN_DOWN: TACTICAL,
  PAN_LEFT: TACTICAL,
  PAN_RIGHT: TACTICAL,
  ZOOM_IN: BOTH,
  ZOOM_OUT: BOTH,
  SELECT: MENU,
  CONFIRM: MENU,
  CANCEL: MENU,
  CYCLE_NEXT: TACTICAL,
  CYCLE_PREV: TACTICAL,
  SELECT_MANEUVER_1: TACTICAL,
  SELECT_MANEUVER_2: TACTICAL,
  SELECT_MANEUVER_3: TACTICAL,
  SELECT_MANEUVER_4: TACTICAL,
  SELECT_MANEUVER_5: TACTICAL,
  EXECUTE_ACTION: TACTICAL,
  FOCUS_SELECTED: TACTICAL,
  RESET_CAMERA: TACTICAL,
  MARK_TARGET: BOTH,
  PAUSE: BOTH,
};

/**
 * @param intent - An intent.
 * @returns The contexts it is listened to in.
 */
export function contextsOf(intent: ActionIntent): readonly BindingContext[] {
  return NON_FLIGHT_CONTEXTS[intent] ?? FLIGHT;
}

/**
 * @param a - An intent.
 * @param b - Another intent.
 * @returns Whether some scene listens to both (so they cannot share a key).
 */
export function sharesContext(a: ActionIntent, b: ActionIntent): boolean {
  const other = contextsOf(b);
  return contextsOf(a).some((context) => other.includes(context));
}
