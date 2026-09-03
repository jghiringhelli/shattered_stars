/**
 * Default input bindings for keyboard, mouse, gamepad, and touch
 */

import type {
  InputProfile,
  KeyboardBinding,
  MouseBinding,
  GamepadBinding,
  TouchBinding,
} from "./InputTypes";

export const DEFAULT_KEYBOARD_BINDINGS: readonly KeyboardBinding[] = [
  // Camera pan (WASD) — tactical/campaign scenes
  { key: "W", intent: "PAN_UP" },
  { key: "S", intent: "PAN_DOWN" },
  { key: "A", intent: "PAN_LEFT" },
  { key: "D", intent: "PAN_RIGHT" },
  // Arrows drive BOTH camera pan (tactical/campaign) and flight steering —
  // harmless overlap, a scene only reacts to the intents it subscribes to.
  { key: "UP", intent: "PAN_UP" },
  { key: "DOWN", intent: "PAN_DOWN" },
  { key: "LEFT", intent: "PAN_LEFT" },
  { key: "RIGHT", intent: "PAN_RIGHT" },
  { key: "UP", intent: "THRUST_UP" },
  { key: "DOWN", intent: "THRUST_DOWN" },
  { key: "LEFT", intent: "STEER_LEFT" },
  { key: "RIGHT", intent: "STEER_RIGHT" },
  // Zoom
  { key: "PLUS", intent: "ZOOM_IN" },
  { key: "MINUS", intent: "ZOOM_OUT" },
  // Selection
  { key: "ENTER", intent: "CONFIRM" },
  { key: "ESC", intent: "CANCEL" },
  { key: "TAB", intent: "CYCLE_NEXT" },
  { key: "TAB", intent: "CYCLE_PREV", modifiers: { shift: true } },
  // Maneuver speeds (number keys) — tactical dial / capital commander orders
  { key: "ONE", intent: "SELECT_MANEUVER_1" },
  { key: "TWO", intent: "SELECT_MANEUVER_2" },
  { key: "THREE", intent: "SELECT_MANEUVER_3" },
  { key: "FOUR", intent: "SELECT_MANEUVER_4" },
  { key: "FIVE", intent: "SELECT_MANEUVER_5" },
  { key: "ONE", intent: "COMMANDER_ORDER_1" },
  { key: "TWO", intent: "COMMANDER_ORDER_2" },
  { key: "THREE", intent: "COMMANDER_ORDER_3" },
  { key: "FOUR", intent: "COMMANDER_ORDER_4" },
  // Flight weapons — primary always autofires, SPACE now triggers secondary/ordnance
  { key: "SPACE", intent: "FIRE_SECONDARY" },
  { key: "TAB", intent: "WEAPON_CYCLE" },
  // Flight advanced (large/capital ships)
  { key: "G", intent: "CREW_CYCLE" },
  { key: "C", intent: "CLOAK" },
  // Other
  { key: "P", intent: "PAUSE" },
  { key: "ESC", intent: "PAUSE" },
  { key: "SPACE", intent: "PAUSE" },
  { key: "F", intent: "FOCUS_SELECTED" },
  { key: "HOME", intent: "RESET_CAMERA" },
];

export const DEFAULT_MOUSE_BINDINGS: readonly MouseBinding[] = [
  { button: "left", intent: "SELECT" },
  { button: "right", intent: "CANCEL" },
  { wheel: "up", intent: "ZOOM_IN" },
  { wheel: "down", intent: "ZOOM_OUT" },
];

/**
 * Touch gesture-zone bindings. The movement stick is handled separately
 * (analog STEER/THRUST plus double-tap up/down for BOOST/KTURN, mirroring
 * the keyboard's existing hold-duration gesture system); these are the
 * small button/gesture-zone actions on the opposite side of the screen.
 */
export const DEFAULT_TOUCH_BINDINGS: readonly TouchBinding[] = [
  { gesture: "tap", intent: "FIRE_SECONDARY" },
  { gesture: "doubleTap", intent: "BARREL_ROLL" },
  { gesture: "hold", intent: "CLOAK" },
];

export const DEFAULT_GAMEPAD_BINDINGS: readonly GamepadBinding[] = [
  // D-pad for camera
  { button: 12, intent: "PAN_UP" }, // D-pad up
  { button: 13, intent: "PAN_DOWN" }, // D-pad down
  { button: 14, intent: "PAN_LEFT" }, // D-pad left
  { button: 15, intent: "PAN_RIGHT" }, // D-pad right
  // Left stick for camera pan AND flight steering (same overlap rationale as keyboard)
  { axis: 0, axisDirection: "negative", intent: "PAN_LEFT", deadzone: 0.2 },
  { axis: 0, axisDirection: "positive", intent: "PAN_RIGHT", deadzone: 0.2 },
  { axis: 1, axisDirection: "negative", intent: "PAN_UP", deadzone: 0.2 },
  { axis: 1, axisDirection: "positive", intent: "PAN_DOWN", deadzone: 0.2 },
  { axis: 0, axisDirection: "negative", intent: "STEER_LEFT", deadzone: 0.2 },
  { axis: 0, axisDirection: "positive", intent: "STEER_RIGHT", deadzone: 0.2 },
  { axis: 1, axisDirection: "negative", intent: "THRUST_UP", deadzone: 0.2 },
  { axis: 1, axisDirection: "positive", intent: "THRUST_DOWN", deadzone: 0.2 },
  // Triggers for zoom
  { button: 6, intent: "ZOOM_OUT" }, // LT
  { button: 7, intent: "ZOOM_IN" }, // RT
  // Face buttons
  { button: 0, intent: "CONFIRM" }, // A / Cross
  { button: 1, intent: "CANCEL" }, // B / Circle
  { button: 2, intent: "FIRE_SECONDARY" }, // X / Square
  { button: 3, intent: "FOCUS_SELECTED" }, // Y / Triangle
  { button: 2, intent: "EXECUTE_ACTION" }, // X / Square (tactical dial confirm)
  // Bumpers for cycling / weapon cycle
  { button: 4, intent: "CYCLE_PREV" }, // LB
  { button: 5, intent: "CYCLE_NEXT" }, // RB
  { button: 5, intent: "WEAPON_CYCLE" }, // RB
  // Start/Select
  { button: 9, intent: "PAUSE" }, // Start
];

export const DEFAULT_INPUT_PROFILE: InputProfile = {
  name: "Default",
  keyboard: DEFAULT_KEYBOARD_BINDINGS,
  mouse: DEFAULT_MOUSE_BINDINGS,
  gamepad: DEFAULT_GAMEPAD_BINDINGS,
  touch: DEFAULT_TOUCH_BINDINGS,
  sensitivity: {
    camera: 1.0,
    zoom: 1.0,
  },
  invertY: false,
};
