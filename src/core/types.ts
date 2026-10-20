/**
 * Core type definitions shared across the game
 */

import type { FactionId, ShipSize } from "../config";

// ============================================
// Ship Types
// ============================================

export type ShipRole =
  | "light_fighter"
  | "heavy_fighter"
  | "interceptor"
  | "bomber"
  | "support"
  | "gunship"
  | "capital";

export type ActionType =
  | "focus"
  | "evade"
  | "target_lock"
  | "barrel_roll"
  | "boost"
  | "coordinate"
  | "jam"
  | "cloak"
  | "slam"
  | "calculate"
  | "reinforce"
  | "rotate_arc"
  | "reload";

export interface ShipStats {
  readonly hull: number;
  readonly shields: number;
  readonly attack: number;
  readonly agility: number;
  /** Flat damage reduction applied to every incoming hit before shields/hull (boss-tier capitals). */
  readonly armor?: number;
  readonly speed: { readonly min: number; readonly max: number };
  readonly size: ShipSize;
  readonly actions: readonly ActionType[];
  readonly pointCost: number;
}

/** A ship's signature trick; "none" = Snap Turn and boost only. */
export type SignatureTrick =
  | "barrel_roll"
  | "hook_loop"
  | "knife_roll"
  | "none";

export interface ShipDefinition {
  readonly id: string;
  readonly name: string;
  readonly faction: FactionId;
  readonly role: ShipRole;
  /**
   * The one of {barrel roll, Hook Loop, Knife Roll} the ship flies under the
   * ship identity rule; absent = the role fallback (src/data/shipSpecials.ts).
   */
  readonly signatureTrick?: SignatureTrick;
  readonly baseStats: ShipStats;
  readonly spriteKey: string;
  readonly description: string;
}

// ============================================
// Movement Types
// ============================================

/**
 * The maneuvers printed on a tabletop ship dial. These are the only directions
 * a dial entry may use, and the only ones with official facing-change rules.
 */
export type DialManeuverDirection =
  | "straight"
  | "bank_left"
  | "bank_right"
  | "turn_left"
  | "turn_right"
  | "kturn"
  | "segnor_left"
  | "segnor_right"
  | "tallon_left"
  | "tallon_right";

/**
 * Every maneuver the movement system can execute: the dial maneuvers plus
 * arcade-only templates that have no dial equivalent.
 */
export type ManeuverDirection =
  | DialManeuverDirection
  /**
   * Sustained shallow turn. Not a tabletop dial maneuver — this is the arcade
   * "held steering key" template, gentle enough that holding it flies a wide
   * arc across the map instead of a tight closed orbit.
   */
  | "drift_left"
  | "drift_right";

export type ManeuverDifficulty = "green" | "white" | "red";

export interface ManeuverDefinition {
  readonly direction: ManeuverDirection;
  readonly speed: number; // 1-5
  readonly difficulty: ManeuverDifficulty;
}

export interface ManeuverTemplate {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaAngle: number;
}

export interface ManeuverResult {
  readonly targetX: number;
  readonly targetY: number;
  readonly targetAngle: number;
  readonly difficulty: ManeuverDifficulty;
}

// ============================================
// Combat Types
// ============================================

export type AttackDiceFace = "hit" | "critical" | "focus" | "blank";
export type DefenseDiceFace = "evade" | "focus" | "blank";

export interface AttackResult {
  readonly attackRoll: readonly AttackDiceFace[];
  readonly defenseRoll: readonly DefenseDiceFace[];
  readonly hitsLanded: number;
  readonly critsLanded: number;
  readonly shieldDamage: number;
  readonly hullDamage: number;
  readonly shipDestroyed: boolean;
}

// ============================================
// Runtime Ship State
// ============================================

export interface ShipState {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";

  // Position & orientation
  x: number;
  y: number;
  angle: number; // degrees, 0 = up/north

  // Current stats
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;

  // Status
  isStressed: boolean;
  hasFocus: boolean;
  hasEvade: boolean;
  hasTargetLock: string | null; // ID of locked ship
  isCloaked: boolean;
  isReinforced?: boolean; // Reinforce action token

  // Current maneuver (if executing)
  currentManeuver: ManeuverDefinition | null;
  maneuverProgress: number; // 0-1

  // Mobile arc (for ships with rotate_arc action)
  mobileArcDirection: "front" | "rear" | "left" | "right";

  // Charges (for weapons/abilities that need reloading)
  charges: number;
  maxCharges: number;

  /** Present only for capital-role ships; tracks engines/turrets/bridge damage. */
  capitalSystems?:
    import("../systems/CapitalSystems").CapitalSystemsState | null;
}

// ============================================
// Event Types
// ============================================

export type GameEventType =
  | "SHIP_SPAWNED"
  | "SHIP_DESTROYED"
  | "SHIP_DAMAGED"
  | "SHIP_MOVED"
  | "MANEUVER_STARTED"
  | "MANEUVER_COMPLETED"
  | "ATTACK_DECLARED"
  | "ATTACK_RESOLVED"
  | "ACTION_PERFORMED"
  | "TURN_STARTED"
  | "TURN_ENDED"
  | "BATTLE_STARTED"
  | "BATTLE_ENDED";

export interface GameEvent {
  readonly type: GameEventType;
  readonly timestamp: number;
  readonly data: Record<string, unknown>;
}
