/**
 * Default input bindings for keyboard, mouse, and gamepad
 */

import type {
  InputProfile,
  KeyboardBinding,
  MouseBinding,
  GamepadBinding,
} from './InputTypes';

export const DEFAULT_KEYBOARD_BINDINGS: readonly KeyboardBinding[] = [
  // Camera pan (WASD)
  { key: 'W', intent: 'PAN_UP' },
  { key: 'S', intent: 'PAN_DOWN' },
  { key: 'A', intent: 'PAN_LEFT' },
  { key: 'D', intent: 'PAN_RIGHT' },
  // Camera pan (arrows)
  { key: 'UP', intent: 'PAN_UP' },
  { key: 'DOWN', intent: 'PAN_DOWN' },
  { key: 'LEFT', intent: 'PAN_LEFT' },
  { key: 'RIGHT', intent: 'PAN_RIGHT' },
  // Zoom
  { key: 'PLUS', intent: 'ZOOM_IN' },
  { key: 'MINUS', intent: 'ZOOM_OUT' },
  // Selection
  { key: 'ENTER', intent: 'CONFIRM' },
  { key: 'SPACE', intent: 'CONFIRM' },
  { key: 'ESC', intent: 'CANCEL' },
  { key: 'TAB', intent: 'CYCLE_NEXT' },
  { key: 'TAB', intent: 'CYCLE_PREV', modifiers: { shift: true } },
  // Maneuver speeds (number keys)
  { key: 'ONE', intent: 'SELECT_MANEUVER_1' },
  { key: 'TWO', intent: 'SELECT_MANEUVER_2' },
  { key: 'THREE', intent: 'SELECT_MANEUVER_3' },
  { key: 'FOUR', intent: 'SELECT_MANEUVER_4' },
  { key: 'FIVE', intent: 'SELECT_MANEUVER_5' },
  // Other
  { key: 'P', intent: 'PAUSE' },
  { key: 'F', intent: 'FOCUS_SELECTED' },
  { key: 'HOME', intent: 'RESET_CAMERA' },
];

export const DEFAULT_MOUSE_BINDINGS: readonly MouseBinding[] = [
  { button: 'left', intent: 'SELECT' },
  { button: 'right', intent: 'CANCEL' },
  { wheel: 'up', intent: 'ZOOM_IN' },
  { wheel: 'down', intent: 'ZOOM_OUT' },
];

export const DEFAULT_GAMEPAD_BINDINGS: readonly GamepadBinding[] = [
  // D-pad for camera
  { button: 12, intent: 'PAN_UP' }, // D-pad up
  { button: 13, intent: 'PAN_DOWN' }, // D-pad down
  { button: 14, intent: 'PAN_LEFT' }, // D-pad left
  { button: 15, intent: 'PAN_RIGHT' }, // D-pad right
  // Left stick for camera (analog)
  { axis: 0, axisDirection: 'negative', intent: 'PAN_LEFT', deadzone: 0.2 },
  { axis: 0, axisDirection: 'positive', intent: 'PAN_RIGHT', deadzone: 0.2 },
  { axis: 1, axisDirection: 'negative', intent: 'PAN_UP', deadzone: 0.2 },
  { axis: 1, axisDirection: 'positive', intent: 'PAN_DOWN', deadzone: 0.2 },
  // Right stick for... (future use, maybe ship rotation preview)
  // Triggers for zoom
  { button: 6, intent: 'ZOOM_OUT' }, // LT
  { button: 7, intent: 'ZOOM_IN' }, // RT
  // Face buttons
  { button: 0, intent: 'CONFIRM' }, // A / Cross
  { button: 1, intent: 'CANCEL' }, // B / Circle
  { button: 2, intent: 'EXECUTE_ACTION' }, // X / Square
  { button: 3, intent: 'FOCUS_SELECTED' }, // Y / Triangle
  // Bumpers for cycling
  { button: 4, intent: 'CYCLE_PREV' }, // LB
  { button: 5, intent: 'CYCLE_NEXT' }, // RB
  // Start/Select
  { button: 9, intent: 'PAUSE' }, // Start
];

export const DEFAULT_INPUT_PROFILE: InputProfile = {
  name: 'Default',
  keyboard: DEFAULT_KEYBOARD_BINDINGS,
  mouse: DEFAULT_MOUSE_BINDINGS,
  gamepad: DEFAULT_GAMEPAD_BINDINGS,
  sensitivity: {
    camera: 1.0,
    zoom: 1.0,
  },
  invertY: false,
};
