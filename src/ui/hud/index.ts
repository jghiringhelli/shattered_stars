/**
 * Holographic battle HUD — public API.
 *
 * Scenes should only need BattleHud + the snapshot types (+ cameraViewFrom).
 * Menu screens use HoloPanel / HoloButton. Individual widgets are exported
 * for screens that want a single piece (e.g. a radar on a briefing screen).
 */

export { BattleHud, type BattleHudConfig } from "./BattleHud";
export { HoloPanel, createHoloPanel, type HoloPanelConfig } from "./HoloPanel";
export {
  HoloButton,
  createHoloButton,
  type HoloButtonConfig,
  type HoloButtonVariant,
} from "./HoloButton";
export {
  ShipStatusRing,
  type ShipStatusRingConfig,
  type ShipStatusRingState,
} from "./ShipStatusRing";
export { WeaponBar, type WeaponBarConfig } from "./WeaponBar";
export { Radar, type RadarConfig } from "./Radar";
export {
  EdgeIndicators,
  DEFAULT_EDGE_CLOSENESS,
  DEFAULT_EDGE_INSETS,
  type EdgeIndicatorsConfig,
} from "./EdgeIndicators";
export { FlightReadout } from "./FlightReadout";
export { MarkReticle, type MarkReticleConfig } from "./MarkReticle";
export {
  markedContacts,
  markReticleWorldRadius,
  nearestImage,
} from "./markMath";
export { cameraViewFrom, type CameraLike, type EdgeInsets } from "./hudMath";
export type { ScreenRect } from "./screenRect";
export type { ClosenessOptions } from "./hudStyleMath";
export type {
  BattleHudSnapshot,
  CameraViewSnapshot,
  ContactHudState,
  HudPose,
  HudSizeClass,
  PlayerHudState,
  WeaponKind,
  WeaponSlotDescriptor,
} from "./types";
