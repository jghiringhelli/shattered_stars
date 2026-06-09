/**
 * Game constants and configuration values
 */

// Display settings
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const BATTLEFIELD_SIZE = 6000; // Large open space; camera follows player at zoom ~0.25
/** Turn-based field sized for X-Wing TMG proportions: Range 3 = 300px ≈ 37% of field, ships 29px at 0.9 zoom. */
export const TURN_BASED_FIELD_SIZE = 800;

// Timing
export const LOGIC_FPS = 60;
export const LOGIC_DELTA = 1000 / LOGIC_FPS; // ~16.67ms per tick

// Movement
export const SPEED_SCALE_FACTOR = 40; // Pixels per speed unit (template unit length)
export const CYCLE_DURATION_MS = 500; // Fixed duration of every maneuver cycle
export const MANEUVER_DURATION_BASE = 500; // ms for speed 1
export const MANEUVER_DURATION_SCALE = 0.15; // Faster speeds are quicker

// Combat ranges (in pixels)
export const RANGE_1 = 100;
export const RANGE_2 = 200;
export const RANGE_3 = 300;

// Camera
export const CAMERA_ZOOM_MIN = 0.5;
export const CAMERA_ZOOM_MAX = 2.0;
export const CAMERA_ZOOM_SPEED = 0.1;
export const CAMERA_FOLLOW_LERP = 0.1;

// Colors per faction (for placeholder shapes)
export const FACTION_COLORS = {
  terran_hegemony: 0x2e4a99,
  free_confederation: 0xff6b35,
  synthetic_collective: 0x0080ff,
  void_corsairs: 0x4b0082,
  ascendant_empire: 0x228b22,
} as const;

export type FactionId = keyof typeof FACTION_COLORS;

// Ship sizes in pixels
export const SHIP_SIZES = {
  tiny: 24,
  small: 32,
  medium: 48,
  large: 64,
  huge: 96,
} as const;

export type ShipSize = keyof typeof SHIP_SIZES;
