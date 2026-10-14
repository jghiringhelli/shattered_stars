/**
 * Input system type definitions
 * Abstracts input devices into game action intents
 */

// ============================================
// Action Intents (device-agnostic)
// ============================================

export type ActionIntent =
  // Navigation (tactical/campaign camera + selection)
  | "PAN_UP"
  | "PAN_DOWN"
  | "PAN_LEFT"
  | "PAN_RIGHT"
  | "ZOOM_IN"
  | "ZOOM_OUT"
  // Selection
  | "SELECT"
  | "CONFIRM"
  | "CANCEL"
  | "CYCLE_NEXT"
  | "CYCLE_PREV"
  // Tactical maneuver dial
  | "SELECT_MANEUVER_1"
  | "SELECT_MANEUVER_2"
  | "SELECT_MANEUVER_3"
  | "SELECT_MANEUVER_4"
  | "SELECT_MANEUVER_5"
  | "EXECUTE_ACTION"
  | "PAUSE"
  // Camera
  | "FOCUS_SELECTED"
  | "RESET_CAMERA"
  // Continuous flight — steering/throttle (held, digital or analog `value`)
  | "STEER_LEFT"
  | "STEER_RIGHT"
  | "THRUST_UP"
  | "THRUST_DOWN"
  // Continuous flight — weapons. Primary fires automatically every cycle
  // (no intent needed); FIRE_SECONDARY triggers ordnance/special weapons.
  | "FIRE_SECONDARY"
  | "WEAPON_CYCLE"
  // Continuous flight — special maneuvers. Barrel roll is a double-tap of the
  // steering arrows/stick (← ← / → →); BOOST is ↑↑.
  | "BOOST"
  | "KTURN"
  | "BARREL_ROLL"
  // Direct roll buttons (optional extra keys, gamepad right-stick flicks).
  | "BARREL_ROLL_LEFT"
  | "BARREL_ROLL_RIGHT"
  // THE maneuver key (HELD): tap = Snap Turn, hold + ←/→ = Hook Loop,
  // double-tap then hold + ←/→ = Knife Roll (ManeuverKey).
  | "MANEUVER"
  // Continuous flight — discrete precision maneuvers (ArcadeBattleScene's
  // richer gesture/stress model; unbound in the simpler dial-based scenes)
  | "SHARP_TURN_LEFT"
  | "SHARP_TURN_RIGHT"
  | "SEGNOR_LEFT"
  | "SEGNOR_RIGHT"
  | "TALLON_LEFT"
  | "TALLON_RIGHT"
  // Squad — mark the HUD target as the squad's focus (SquadMark): player-side
  // AI wingmen attack it, and the squad's shots on it gain the mark bonus.
  | "MARK_TARGET"
  // Hero pilot active powers (Campaign heroes; cooldown-based)
  | "HERO_POWER_1"
  | "HERO_POWER_2"
  // Continuous flight — advanced (large/capital ships)
  | "CREW_CYCLE"
  | "CLOAK"
  | "COMMANDER_ORDER_1"
  | "COMMANDER_ORDER_2"
  | "COMMANDER_ORDER_3"
  | "COMMANDER_ORDER_4";

// ============================================
// Input Events
// ============================================

export interface InputEvent {
  readonly intent: ActionIntent;
  readonly timestamp: number;
  readonly source: InputSource;
  readonly value: number; // 0-1 for analog, 0 or 1 for digital
  readonly position?: { x: number; y: number }; // For pointer-based inputs
}

export type InputSource =
  | "keyboard"
  | "mouse"
  | "gamepad"
  | "touch"
  | "joystick"
  | "ar_gesture"
  | "ar_gaze"
  | "ar_head"
  | "voice";

// ============================================
// Input Bindings
// ============================================

export interface KeyboardBinding {
  readonly key: string; // Phaser key code
  readonly intent: ActionIntent;
  readonly modifiers?: {
    readonly shift?: boolean;
    readonly ctrl?: boolean;
    readonly alt?: boolean;
  };
}

export interface GamepadBinding {
  readonly button?: number; // Button index
  readonly axis?: number; // Axis index
  readonly axisDirection?: "positive" | "negative";
  readonly intent: ActionIntent;
  readonly deadzone?: number;
}

export interface MouseBinding {
  readonly button?: "left" | "right" | "middle";
  readonly wheel?: "up" | "down";
  readonly intent: ActionIntent;
}

/** A gesture-zone action on touch: tap fires once, doubleTap needs two taps within a short window, hold fires while held. */
export interface TouchBinding {
  readonly gesture: "tap" | "doubleTap" | "hold";
  readonly intent: ActionIntent;
}

// ============================================
// Input Adapter Interface
// ============================================

export interface InputAdapter {
  readonly source: InputSource;

  /** Initialize the adapter */
  init(): void;

  /** Clean up resources */
  destroy(): void;

  /** Check if adapter is available (device connected) */
  isAvailable(): boolean;

  /** Poll for current input state (called each frame) */
  poll(): InputEvent[];
}

// ============================================
// Input Profile (user preferences)
// ============================================

export interface InputProfile {
  readonly name: string;
  readonly keyboard: readonly KeyboardBinding[];
  readonly gamepad: readonly GamepadBinding[];
  readonly mouse: readonly MouseBinding[];
  readonly touch: readonly TouchBinding[];
  readonly sensitivity: {
    readonly camera: number;
    readonly zoom: number;
  };
  readonly invertY: boolean;
}
