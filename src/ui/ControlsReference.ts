/**
 * ControlsReference — curated, data-driven "how do I do X" reference.
 *
 * Row labels/grouping are hand-curated for readability, but the actual key/
 * button/gesture shown for each row is always derived live from
 * DefaultBindings.ts — never hardcoded — so this can never drift out of
 * sync with the real bindings.
 */

import type { ActionIntent, KeyboardBinding } from "../input/InputTypes";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_TOUCH_BINDINGS,
} from "../input/DefaultBindings";

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
      { label: "K-Turn (180°)", intents: ["KTURN"] },
      { label: "Boost Dash", intents: ["BOOST"] },
      { label: "Barrel Roll", intents: ["BARREL_ROLL"] },
      {
        label: "Sharp Turn",
        intents: ["SHARP_TURN_LEFT", "SHARP_TURN_RIGHT"],
      },
      { label: "Segnor Loop", intents: ["SEGNOR_LEFT", "SEGNOR_RIGHT"] },
      { label: "Tallon Roll", intents: ["TALLON_LEFT", "TALLON_RIGHT"] },
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

const GAMEPAD_BUTTON_NAMES: Record<number, string> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  9: "Start",
  12: "D-Up",
  13: "D-Down",
  14: "D-Left",
  15: "D-Right",
};

const GAMEPAD_AXIS_NAMES: Record<number, string> = {
  0: "Left Stick",
  1: "Left Stick",
};

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

export function keyboardLabelFor(intents: readonly ActionIntent[]): string {
  if (intents.length === 0) return "Automatic";
  const labels = DEFAULT_KEYBOARD_BINDINGS.filter((b) =>
    intents.includes(b.intent),
  ).map(formatKeyboardBinding);
  return uniqueJoin(labels);
}

export function gamepadLabelFor(intents: readonly ActionIntent[]): string {
  if (intents.length === 0) return "Automatic";
  const labels = DEFAULT_GAMEPAD_BINDINGS.filter((b) =>
    intents.includes(b.intent),
  ).map((b) => {
    if (b.button !== undefined)
      return GAMEPAD_BUTTON_NAMES[b.button] ?? `Btn ${b.button}`;
    if (b.axis !== undefined)
      return GAMEPAD_AXIS_NAMES[b.axis] ?? `Axis ${b.axis}`;
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
