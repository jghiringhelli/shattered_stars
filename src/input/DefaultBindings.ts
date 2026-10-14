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
  // Flight weapons — primary always autofires; SHIFT+SPACE triggers
  // secondary/ordnance (bomb deploy in ArcadeBattleScene).
  { key: "SPACE", intent: "FIRE_SECONDARY", modifiers: { shift: true } },
  { key: "TAB", intent: "WEAPON_CYCLE" },
  // Flight advanced (large/capital ships)
  { key: "G", intent: "CREW_CYCLE" },
  { key: "C", intent: "CLOAK" },
  // THE maneuver key (held): tap = Snap Turn, hold + ←/→ = Hook Loop,
  // double-tap then hold + ←/→ = Knife Roll. Barrel roll = ← ← / → → (gesture),
  // boost = ↑↑, Snap Turn also ↓↓ — none of those has a key of its own.
  { key: "Z", intent: "MANEUVER" },
  { key: "Q", intent: "SHARP_TURN_LEFT" },
  { key: "E", intent: "SHARP_TURN_RIGHT" },
  // Squad: mark the HUD target as the squad's focus (SquadMark)
  { key: "R", intent: "MARK_TARGET" },
  // Hero pilot active powers (Campaign)
  { key: "V", intent: "HERO_POWER_1" },
  { key: "B", intent: "HERO_POWER_2" },
  // Other — plain Space is unbound in flight: it was the old fire key, and
  // pausing on it froze battles for players (and on an early Shift release).
  { key: "P", intent: "PAUSE" },
  { key: "ESC", intent: "PAUSE" },
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
 * (analog STEER/THRUST; a double-tap or double-flick to one side is the
 * barrel roll, double-tap up/down BOOST/KTURN — the same gesture machine as
 * the keyboard); the MANEUVER button beside the action zone is the held
 * maneuver key. These are the small gesture-zone actions of the FIRE zone.
 */
export const DEFAULT_TOUCH_BINDINGS: readonly TouchBinding[] = [
  { gesture: "tap", intent: "FIRE_SECONDARY" },
  { gesture: "hold", intent: "CLOAK" },
];

/**
 * Right-stick flicks must pass this deflection to fire a maneuver, so a
 * resting or lightly brushed stick never rolls the ship.
 */
export const RIGHT_STICK_FLICK_DEADZONE = 0.6;

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
  // THE maneuver button (held): tap = Snap Turn, hold + left stick ←/→ = Hook
  // Loop, double-tap then hold + stick ←/→ = Knife Roll. Barrel roll = a
  // double-flick of the left stick to one side (the steering gesture) or a
  // right-stick flick. (Camera zoom is wheel/auto in every scene; no scene
  // reads the ZOOM intents, so the triggers are free for flight.)
  { button: 6, intent: "MANEUVER" }, // LT
  // Commander orders (capital ship, crew role commander) share LT, RT and
  // the d-pad sides: no capital ship can fly a maneuver (FlightCapabilities).
  { button: 6, intent: "COMMANDER_ORDER_1" }, // LT
  { button: 7, intent: "COMMANDER_ORDER_2" }, // RT
  { button: 14, intent: "COMMANDER_ORDER_3" }, // D-pad left
  { button: 15, intent: "COMMANDER_ORDER_4" }, // D-pad right
  // Face buttons
  { button: 0, intent: "CONFIRM" }, // A / Cross
  { button: 0, intent: "BOOST" }, // A / Cross (flight)
  { button: 1, intent: "CANCEL" }, // B / Circle
  { button: 2, intent: "FIRE_SECONDARY" }, // X / Square
  { button: 3, intent: "FOCUS_SELECTED" }, // Y / Triangle
  { button: 2, intent: "EXECUTE_ACTION" }, // X / Square (tactical dial confirm)
  // Bumpers: cycle selection (tactical) / hard turns (flight, keyboard Q/E)
  { button: 4, intent: "CYCLE_PREV" }, // LB
  { button: 4, intent: "SHARP_TURN_LEFT" }, // LB (flight)
  { button: 5, intent: "CYCLE_NEXT" }, // RB
  { button: 5, intent: "SHARP_TURN_RIGHT" }, // RB (flight)
  // D-pad in flight (it pans the camera in tactical scenes)
  { button: 12, intent: "CLOAK" }, // D-pad up
  { button: 13, intent: "WEAPON_CYCLE" }, // D-pad down
  { button: 8, intent: "CREW_CYCLE" }, // Back / View
  // Right-stick flicks (edge-triggered, firm flick): ←/→ barrel roll,
  // ↓ Snap turn (turn about)
  {
    axis: 2,
    axisDirection: "negative",
    intent: "BARREL_ROLL_LEFT",
    deadzone: RIGHT_STICK_FLICK_DEADZONE,
  },
  {
    axis: 2,
    axisDirection: "positive",
    intent: "BARREL_ROLL_RIGHT",
    deadzone: RIGHT_STICK_FLICK_DEADZONE,
  },
  {
    axis: 3,
    axisDirection: "positive",
    intent: "KTURN",
    deadzone: RIGHT_STICK_FLICK_DEADZONE,
  },
  // Start/Select
  { button: 9, intent: "PAUSE" }, // Start
  // Right-stick click: mark the HUD target as the squad's focus
  { button: 11, intent: "MARK_TARGET" }, // R3
  // Hero pilot active powers (Campaign)
  { button: 3, intent: "HERO_POWER_1" }, // Y / Triangle (flight scenes)
  { button: 10, intent: "HERO_POWER_2" }, // L3
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
