/**
 * GamepadBindings — gamepad button rebinding over DefaultBindings, with the
 * keyboard's rules (KeyBindings.ts): a profile stores only overrides
 * (intent → button index, or null = unbound); two intents conflict when they
 * share a button and a context (RebindableIntents); rebinding onto a taken
 * button swaps (the displaced intent takes the rebound intent's old button).
 *
 * Only buttons are rebindable: steering and throttle stay on the left stick,
 * B stays "back" in every menu and Start stays "pause" (like ESC on the
 * keyboard). Indices follow the W3C "standard" gamepad layout.
 *
 * Pure: no Phaser.
 */

import type { ActionIntent, GamepadBinding } from "./InputTypes";
import {
  REBINDABLE_INTENTS,
  isRebindableIntent,
  sharesContext,
  type RebindableIntent,
} from "./RebindableIntents";

/** A profile's changes to the default gamepad buttons. */
export type GamepadOverrides = Readonly<
  Partial<Record<ActionIntent, number | null>>
>;

/**
 * Why a button cannot be bound. "fixed": a non-rebindable intent (menu
 * confirm, tactical dial…) needs it in a context the intent shares — a swap
 * would leave that intent on a button it could never be moved back from.
 */
export type ButtonProblem = "reserved" | "unknown_button" | "fixed";

/** Buttons in the W3C standard layout (0 = A … 15 = D-pad right). */
export const GAMEPAD_BUTTON_COUNT = 16;

/** B (back in every menu) and Start (pause) keep their default intents. */
const RESERVED_BUTTONS: ReadonlySet<number> = new Set([1, 9]);

/** Intents driven by the left stick, never by a rebindable button. */
const STICK_INTENTS: ReadonlySet<ActionIntent> = new Set([
  "STEER_LEFT",
  "STEER_RIGHT",
  "THRUST_UP",
  "THRUST_DOWN",
]);

/** Display names of the standard-layout buttons (Xbox labels). */
export const GAMEPAD_BUTTON_NAMES: Readonly<Record<number, string>> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "Back",
  9: "Start",
  10: "L3",
  11: "R3",
  12: "D-Up",
  13: "D-Down",
  14: "D-Left",
  15: "D-Right",
};

/** Every gamepad-rebindable intent, in Settings display order. */
export const GAMEPAD_REBINDABLE_INTENTS: readonly RebindableIntent[] =
  REBINDABLE_INTENTS.filter(
    (r) => !STICK_INTENTS.has(r.intent) && r.intent !== "PAUSE",
  );

const GAMEPAD_REBINDABLE_SET: ReadonlySet<ActionIntent> = new Set(
  GAMEPAD_REBINDABLE_INTENTS.map((r) => r.intent),
);

/** Result of {@link rebindGamepadIntent}. */
export interface GamepadRebindResult {
  readonly overrides: GamepadOverrides;
  /** Intents that lost the button (swapped onto the old one, or unbound). */
  readonly displaced: readonly ActionIntent[];
  /** Why the button was refused; null when applied. */
  readonly rejected: ButtonProblem | null;
}

/** Two or more intents sharing a button in a shared context. */
export interface ButtonConflict {
  readonly button: number;
  readonly intents: readonly ActionIntent[];
}

function isReservedBinding(binding: GamepadBinding): boolean {
  return binding.button !== undefined && RESERVED_BUTTONS.has(binding.button);
}

/**
 * @param button - A button index.
 * @returns "ok", or why it cannot be bound.
 */
export function validateButton(button: number): ButtonProblem | "ok" {
  if (!Number.isInteger(button) || button < 0 || button >= GAMEPAD_BUTTON_COUNT)
    return "unknown_button";
  return RESERVED_BUTTONS.has(button) ? "reserved" : "ok";
}

/**
 * Effective bindings: each overridden intent loses its non-reserved default
 * buttons (stick axes stay) and gains its override in place of the first.
 *
 * @param defaults - Default gamepad bindings.
 * @param overrides - Profile overrides.
 * @returns The bindings the gamepad adapter should use.
 */
export function applyGamepadOverrides(
  defaults: readonly GamepadBinding[],
  overrides: GamepadOverrides,
): GamepadBinding[] {
  const placed = new Set<ActionIntent>();
  const result: GamepadBinding[] = [];
  for (const binding of defaults) {
    const override = overrides[binding.intent];
    const keep =
      override === undefined ||
      binding.button === undefined ||
      isReservedBinding(binding);
    if (keep) {
      result.push(binding);
      continue;
    }
    if (placed.has(binding.intent)) continue;
    placed.add(binding.intent);
    if (override !== null)
      result.push({ button: override, intent: binding.intent });
  }
  for (const [intent, button] of Object.entries(overrides)) {
    const typed = intent as ActionIntent;
    if (typeof button === "number" && !placed.has(typed))
      result.push({ button, intent: typed });
  }
  return result;
}

/**
 * @param bindings - Effective bindings.
 * @param intent - An intent.
 * @returns The first non-reserved button bound to it, or null.
 */
export function primaryButton(
  bindings: readonly GamepadBinding[],
  intent: ActionIntent,
): number | null {
  const binding = bindings.find(
    (b) =>
      b.intent === intent && b.button !== undefined && !isReservedBinding(b),
  );
  return binding?.button ?? null;
}

/**
 * @param bindings - Effective bindings.
 * @param intent - The intent being bound.
 * @param button - The button it would take.
 * @returns Other intents on that button that share a context with it.
 */
export function findButtonConflicts(
  bindings: readonly GamepadBinding[],
  intent: ActionIntent,
  button: number,
): ActionIntent[] {
  const found: ActionIntent[] = [];
  for (const binding of bindings) {
    if (binding.intent === intent || found.includes(binding.intent)) continue;
    if (binding.button !== button) continue;
    if (sharesContext(intent, binding.intent)) found.push(binding.intent);
  }
  return found;
}

/**
 * @param bindings - Effective bindings.
 * @returns Every button shared by intents that share a context.
 */
export function findAllButtonConflicts(
  bindings: readonly GamepadBinding[],
): ButtonConflict[] {
  const conflicts: ButtonConflict[] = [];
  bindings.forEach((binding, index) => {
    if (binding.button === undefined) return;
    const clash = findButtonConflicts(
      bindings.slice(index + 1),
      binding.intent,
      binding.button,
    );
    if (clash.length > 0)
      conflicts.push({
        button: binding.button,
        intents: [binding.intent, ...clash],
      });
  });
  return conflicts;
}

/**
 * Bind `intent` to `button`; any intent that loses the button takes the
 * rebound intent's previous button (or is unbound if that clashes too).
 *
 * @param defaults - Default gamepad bindings.
 * @param overrides - Current profile overrides.
 * @param intent - Intent to rebind.
 * @param button - New button index.
 * @returns New overrides and the displaced intents.
 */
export function rebindGamepadIntent(
  defaults: readonly GamepadBinding[],
  overrides: GamepadOverrides,
  intent: ActionIntent,
  button: number,
): GamepadRebindResult {
  const problem = validateButton(button);
  if (problem !== "ok") return { overrides, displaced: [], rejected: problem };
  const current = applyGamepadOverrides(defaults, overrides);
  const oldButton = primaryButton(current, intent);
  const displaced = findButtonConflicts(current, intent, button);
  if (displaced.some((loser) => !GAMEPAD_REBINDABLE_SET.has(loser)))
    return { overrides, displaced: [], rejected: "fixed" };
  const next: Partial<Record<ActionIntent, number | null>> = {
    ...overrides,
    [intent]: button,
  };
  for (const loser of displaced) {
    next[loser] = oldButton;
    const after = applyGamepadOverrides(defaults, next);
    if (
      oldButton !== null &&
      findButtonConflicts(after, loser, oldButton).length > 0
    )
      next[loser] = null;
  }
  return { overrides: next, displaced, rejected: null };
}

/**
 * @param button - A button index, or null when unbound.
 * @returns Display text such as "A", "R3" or "Unbound".
 */
export function gamepadButtonLabel(button: number | null): string {
  if (button === null) return "Unbound";
  return GAMEPAD_BUTTON_NAMES[button] ?? `Btn ${button}`;
}

/**
 * Tolerant reader for stored overrides: unknown intents, stick intents,
 * reserved or out-of-layout buttons are dropped; null (unbound) is kept.
 *
 * @param raw - Parsed JSON (any shape).
 * @returns Valid overrides.
 */
export function parseGamepadOverrides(raw: unknown): GamepadOverrides {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const result: Partial<Record<ActionIntent, number | null>> = {};
  for (const [intent, value] of Object.entries(raw)) {
    if (!isRebindableIntent(intent) || !GAMEPAD_REBINDABLE_SET.has(intent))
      continue;
    if (value === null) result[intent] = null;
    else if (typeof value === "number" && validateButton(value) === "ok")
      result[intent] = value;
  }
  return result;
}
