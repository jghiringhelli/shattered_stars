/**
 * ControlsReference — curated, data-driven "how do I do X" reference.
 *
 * Row labels/grouping are hand-curated for readability, but the actual key/
 * button/gesture shown for each row is always derived live from the
 * bindings — keyboard from the player's active profile (DefaultBindings.ts
 * plus Settings rebinding overrides), gamepad likewise (Settings › Gamepad),
 * touch from DefaultBindings.ts
 * — never hardcoded, so this can never drift out of sync with real input.
 */

import type {
  ActionIntent,
  GamepadBinding,
  KeyboardBinding,
} from "../input/InputTypes";
import { DEFAULT_TOUCH_BINDINGS } from "../input/DefaultBindings";
import { gamepadButtonLabel } from "../input/GamepadBindings";
import {
  activeGamepadBindings,
  activeKeyboardBindings,
  boundKeyLabel,
} from "../input/boundKeyLabel";

export interface ControlRow {
  readonly label: string;
  readonly intents: readonly ActionIntent[];
}

export interface ControlGroup {
  readonly title: string;
  readonly rows: readonly ControlRow[];
}

export const CONTROL_GROUPS: readonly ControlGroup[] = [
  {
    title: "Flight & Combat",
    rows: [
      { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
      { label: "Throttle Up / Down", intents: ["THRUST_UP", "THRUST_DOWN"] },
      { label: "Primary Weapon", intents: [] }, // always autofires, no input
      { label: "Snap Turn (180°)", intents: ["KTURN"] },
      { label: "Boost Dash", intents: ["BOOST"] },
      {
        label: "Barrel Roll",
        intents: ["BARREL_ROLL", "BARREL_ROLL_LEFT", "BARREL_ROLL_RIGHT"],
      },
      {
        label: "Sharp Turn",
        intents: ["SHARP_TURN_LEFT", "SHARP_TURN_RIGHT"],
      },
      { label: "Hook Loop", intents: ["SEGNOR_LEFT", "SEGNOR_RIGHT"] },
      { label: "Knife Roll", intents: ["TALLON_LEFT", "TALLON_RIGHT"] },
      { label: "Mark Target (squad focus)", intents: ["MARK_TARGET"] },
      {
        label: "Hero Powers (Campaign)",
        intents: ["HERO_POWER_1", "HERO_POWER_2"],
      },
      { label: "Fire Secondary / Bomb", intents: ["FIRE_SECONDARY"] },
      { label: "Cycle Weapon", intents: ["WEAPON_CYCLE"] },
      { label: "Cloak", intents: ["CLOAK"] },
      { label: "Cycle Crew Role", intents: ["CREW_CYCLE"] },
      {
        label: "Commander Orders",
        intents: [
          "COMMANDER_ORDER_1",
          "COMMANDER_ORDER_2",
          "COMMANDER_ORDER_3",
          "COMMANDER_ORDER_4",
        ],
      },
    ],
  },
  {
    title: "Tactical & Camera",
    rows: [
      {
        label: "Pan Camera",
        intents: ["PAN_UP", "PAN_DOWN", "PAN_LEFT", "PAN_RIGHT"],
      },
      { label: "Zoom In / Out", intents: ["ZOOM_IN", "ZOOM_OUT"] },
      {
        label: "Select Maneuver",
        intents: [
          "SELECT_MANEUVER_1",
          "SELECT_MANEUVER_2",
          "SELECT_MANEUVER_3",
          "SELECT_MANEUVER_4",
          "SELECT_MANEUVER_5",
        ],
      },
      { label: "Execute Action", intents: ["EXECUTE_ACTION"] },
      { label: "Focus Selected Ship", intents: ["FOCUS_SELECTED"] },
      { label: "Reset Camera", intents: ["RESET_CAMERA"] },
      { label: "Cycle Selection", intents: ["CYCLE_NEXT", "CYCLE_PREV"] },
    ],
  },
  {
    title: "Menus & System",
    rows: [
      { label: "Select / Confirm", intents: ["SELECT", "CONFIRM"] },
      { label: "Cancel / Back", intents: ["CANCEL"] },
      { label: "Pause", intents: ["PAUSE"] },
    ],
  },
];

const NICE_KEY_NAMES: Record<string, string> = {
  UP: "↑",
  DOWN: "↓",
  LEFT: "←",
  RIGHT: "→",
  ESC: "Esc",
  PLUS: "+",
  MINUS: "-",
  ONE: "1",
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
};

/** Stick-axis labels by axis and direction (right-stick flicks name theirs). */
const GAMEPAD_AXIS_NAMES: Record<string, string> = {
  "0:negative": "Left Stick",
  "0:positive": "Left Stick",
  "1:negative": "Left Stick",
  "1:positive": "Left Stick",
  "2:negative": "Right Stick ←/→ flick",
  "2:positive": "Right Stick ←/→ flick",
  "3:negative": "Right Stick ↑ flick",
  "3:positive": "Right Stick ↓ flick",
};

/**
 * @param binding - A stick-axis binding.
 * @returns How the Controls screen names it.
 */
function gamepadAxisLabel(binding: GamepadBinding): string {
  const key = `${binding.axis}:${binding.axisDirection ?? "positive"}`;
  return GAMEPAD_AXIS_NAMES[key] ?? `Axis ${binding.axis}`;
}

const TOUCH_STICK_INTENTS: ReadonlySet<ActionIntent> = new Set([
  "STEER_LEFT",
  "STEER_RIGHT",
  "THRUST_UP",
  "THRUST_DOWN",
]);

/** BOOST/KTURN reach the player via a double-tap on the stick itself, not
 * the gesture-zone binding table — see TouchFlightControls.ts. */
const TOUCH_SPECIAL_LABELS: Partial<Record<ActionIntent, string>> = {
  BOOST: "Double-tap stick up",
  KTURN: "Double-tap stick down",
};

/** BOOST/BARREL_ROLL have no direct KeyboardBinding entry — they're produced
 * by ArcadeInputGestures.ts's hold/double-tap/chord state machine on the
 * same steer/thrust keys, not a dedicated key — so their label is built
 * from those (possibly rebound) keys by boundKeyLabel(). */
const KEYBOARD_GESTURE_INTENTS: ReadonlySet<ActionIntent> = new Set([
  "BOOST",
  "BARREL_ROLL",
]);

const TOUCH_GESTURE_NAMES: Record<string, string> = {
  tap: "Tap action zone",
  doubleTap: "Double-tap action zone",
  hold: "Hold action zone",
};

function uniqueJoin(labels: readonly string[]): string {
  const unique = [...new Set(labels.filter((l) => l.length > 0))];
  return unique.length > 0 ? unique.join(" / ") : "—";
}

function formatKeyboardBinding(binding: KeyboardBinding): string {
  const key = NICE_KEY_NAMES[binding.key] ?? binding.key;
  const prefix = binding.modifiers?.shift
    ? "Shift+"
    : binding.modifiers?.ctrl
      ? "Ctrl+"
      : binding.modifiers?.alt
        ? "Alt+"
        : "";
  return prefix + key;
}

/**
 * @param intents - Intents of one reference row.
 * @param bindings - Keyboard bindings (default: the player's live profile,
 *   so rebound keys show everywhere).
 * @returns The row's keyboard label.
 */
export function keyboardLabelFor(
  intents: readonly ActionIntent[],
  bindings: readonly KeyboardBinding[] = activeKeyboardBindings(),
): string {
  if (intents.length === 0) return "Automatic";
  const labels = intents.map((intent) => {
    if (KEYBOARD_GESTURE_INTENTS.has(intent))
      return boundKeyLabel(intent, bindings);
    return bindings
      .filter((b) => b.intent === intent)
      .map(formatKeyboardBinding);
  });
  return uniqueJoin(labels.flat());
}

/**
 * @param intents - Intents of one reference row.
 * @param bindings - Gamepad bindings (default: the player's live profile,
 *   so rebound buttons show everywhere).
 * @returns The row's gamepad label.
 */
export function gamepadLabelFor(
  intents: readonly ActionIntent[],
  bindings: readonly GamepadBinding[] = activeGamepadBindings(),
): string {
  if (intents.length === 0) return "Automatic";
  const labels = bindings
    .filter((b) => intents.includes(b.intent))
    .map((b) => {
      if (b.button !== undefined) return gamepadButtonLabel(b.button);
      if (b.axis !== undefined) return gamepadAxisLabel(b);
      return "";
    });
  return uniqueJoin(labels);
}

export function touchLabelFor(intents: readonly ActionIntent[]): string {
  if (intents.length === 0) return "Automatic";
  const labels = intents.map((intent) => {
    if (TOUCH_STICK_INTENTS.has(intent)) return "Left Stick";
    if (TOUCH_SPECIAL_LABELS[intent]) return TOUCH_SPECIAL_LABELS[intent]!;
    const binding = DEFAULT_TOUCH_BINDINGS.find((b) => b.intent === intent);
    return binding ? TOUCH_GESTURE_NAMES[binding.gesture] : "";
  });
  return uniqueJoin(labels.filter((l): l is string => !!l));
}

/**
 * Builds a single-line "Label: Key  ·  Label: Key" contextual tip string for
 * a setup screen, using the keyboard binding (the lowest-common-denominator
 * device) for each entry. Used by mode setup screens that only have room for
 * one quick reminder rather than the full ControlsScene reference.
 */
export function quickTipLine(
  entries: ReadonlyArray<{ label: string; intents: readonly ActionIntent[] }>,
): string {
  return entries
    .map((e) => `${e.label}: ${keyboardLabelFor(e.intents)}`)
    .join("   \u00b7   ");
}
