/**
 * Data contracts for the holographic battle HUD.
 *
 * Scenes build a {@link BattleHudSnapshot} from their own state each frame
 * and hand it to BattleHud; nothing here references scene or component
 * internals. Plain readonly data — no behaviour.
 */

import type { ShipSize } from "../../config";
import type { HoloSide } from "../theme/HoloTheme";

/** World pose. `angle` is degrees, 0 = up/north, clockwise positive (ShipState convention). */
export interface HudPose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** A world-space point. */
export interface HudPoint {
  readonly x: number;
  readonly y: number;
}

/** Ship size class — drives blip size. Same keys as SHIP_SIZES. */
export type HudSizeClass = ShipSize;

/** The local player's ship. */
export interface PlayerHudState {
  readonly pose: HudPose;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  /** Stress level 0..1 (ArcadeStress `level`). */
  readonly stress: number;
  /** Hysteresis-latched stressed flag (ArcadeStress `isStressed`). */
  readonly isStressed: boolean;
  readonly speed: number;
  readonly maxSpeed: number;
  /** Short maneuver label, e.g. "BANK L 3"; null when none. */
  readonly maneuver: string | null;
}

/** Any other ship the HUD should track. */
export interface ContactHudState {
  readonly id: string;
  readonly pose: HudPose;
  readonly side: HoloSide;
  readonly sizeClass: HudSizeClass;
  /** True for the player's locked target. */
  readonly isTarget: boolean;
  /**
   * True for the squad's marked target (SquadMark — the player's mark, or the
   * side's focus): a red crosshair on radar, edge arrow and in the world.
   */
  readonly isMarked?: boolean | undefined;
  readonly alive: boolean;
}

/** Weapon slot categories — each has its own icon. */
export type WeaponKind =
  "primary" | "missile" | "torpedo" | "turret" | "bomb" | "mine";

/** One slot in the weapon bar. */
export interface WeaponSlotDescriptor {
  readonly id: string;
  readonly kind: WeaponKind;
  /** Remaining charges; omit for unlimited (primary, turret). */
  readonly charges?: number;
  /** Maximum charges; omit for unlimited. */
  readonly maxCharges?: number;
  /** Cooldown remaining as a fraction: 0 = ready, 1 = just fired. */
  readonly cooldown: number;
  /** True for the currently selected secondary/primary weapon. */
  readonly selected: boolean;
  /** Optional binding hint shown on the slot, e.g. "1". */
  readonly keyHint?: string;
}

/**
 * Camera view in the snapshot. Use `cameraViewFrom` to build it from a
 * Phaser camera.
 */
export interface CameraViewSnapshot {
  /** World x at the centre of the view. */
  readonly centerX: number;
  /** World y at the centre of the view. */
  readonly centerY: number;
  /** Camera zoom (> 0). */
  readonly zoom: number;
  /** Viewport width in screen pixels. */
  readonly width: number;
  /** Viewport height in screen pixels. */
  readonly height: number;
}

/** Everything BattleHud needs for one frame. */
export interface BattleHudSnapshot {
  /** Local player; null hides player-centric widgets (e.g. after death). */
  readonly player: PlayerHudState | null;
  readonly contacts: ReadonlyArray<ContactHudState>;
  readonly weapons: ReadonlyArray<WeaponSlotDescriptor>;
  readonly camera: CameraViewSnapshot;
}
