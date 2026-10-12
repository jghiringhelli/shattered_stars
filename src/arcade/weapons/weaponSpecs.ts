/**
 * weaponSpecs — the real-time rules of every secondary weapon, read straight
 * from its upgrade card (src/data/upgrades/weapons.ts) so the card's text,
 * price and battle behaviour come from one place:
 *
 * - Launchers (missiles, torpedoes): need a target lock, fire from the
 *   front arc (X-Wing 80°) at the card's range band (default 2–3), fly as
 *   homing projectiles and hit for card damage × ORDNANCE_DAMAGE_SCALE.
 * - Devices (bombs, mines): dropped astern. A bomb detonates on a timed
 *   fuse; a mine arms after a cycle and waits for an enemy to touch it.
 *   Either blast hits EVERY ship in its radius (X-Wing devices are
 *   indiscriminate: friendly fire applies).
 * - Turrets: all-round (360°) auto-tracking at the card's band (default
 *   1–2), card damage per hit like a primary laser.
 *
 * Pure: no Phaser.
 */

import {
  CYCLE_DURATION_MS,
  ORDNANCE_DAMAGE_SCALE,
  RANGE_1,
  RANGE_2,
  RANGE_3,
  SPEED_SCALE_FACTOR,
} from "../../config";
import type { WeaponProfile } from "../../core/upgradeTypes";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";

/** Weapons fired at a locked target. */
export type LauncherKind = "missile" | "torpedo";
/** Weapons dropped astern. */
export type DeviceKind = "bomb" | "mine";
/** Every selectable secondary weapon. */
export type SecondaryKind = LauncherKind | DeviceKind;

/** A range band in px, min inclusive, max exclusive. */
export interface RangeBandPx {
  readonly minRangePx: number;
  readonly maxRangePx: number;
}

/** Range band and arc a weapon engages within. */
export interface WeaponEnvelope extends RangeBandPx {
  readonly arcDeg: number;
}

/** What every secondary slot shares. */
interface SlotSpecBase {
  readonly upgradeId: string;
  readonly name: string;
  /** Damage per hit (or per blast), already at ORDNANCE_DAMAGE_SCALE. */
  readonly damage: number;
  readonly stressOnHit: number;
  readonly cooldownMs: number;
  readonly charges: number;
}

/** A missile or torpedo rack. */
export interface LauncherSpec extends SlotSpecBase {
  readonly kind: LauncherKind;
  readonly envelope: WeaponEnvelope;
  readonly speedPxPerS: number;
  readonly lifetimeMs: number;
  readonly homingTurnRate: number;
  readonly homingTurnBudget: number;
  /** Attack dice rolled against the target's agility on impact (card damage). */
  readonly attackDice: number;
}

/** A bomb or mine bay. */
export interface DeviceSpec extends SlotSpecBase {
  readonly kind: DeviceKind;
  /** Bomb: time from drop to blast. Mine: unused (0). */
  readonly fuseMs: number;
  /** Mine: time from drop until it can be triggered. Bomb: 0. */
  readonly armMs: number;
  /** Mine: an enemy this close sets it off. Bomb: 0. */
  readonly triggerRadiusPx: number;
  readonly blastRadiusPx: number;
  /** A mine nobody touched fizzles after this long. */
  readonly lifetimeMs: number;
}

/** One secondary slot's rules. */
export type SecondarySpec = LauncherSpec | DeviceSpec;

/** An auto-tracking turret's rules. */
export interface TurretSpec {
  readonly upgradeId: string;
  readonly name: string;
  /** Damage per hit (primary-laser scale). */
  readonly damage: number;
  readonly stressOnHit: number;
  readonly cooldownMs: number;
  readonly envelope: WeaponEnvelope;
}

/**
 * @param spec - A slot's rules.
 * @returns True for a missile or torpedo rack (false for a device bay).
 */
export function isLauncher(spec: SecondarySpec): spec is LauncherSpec {
  return spec.kind === "missile" || spec.kind === "torpedo";
}

/** X-Wing front arc: launchers fire at targets within ±40° of the nose. */
export const LAUNCH_ARC_DEG = 80;
/** All-round turret arc. */
export const TURRET_ARC_DEG = 360;
/** Charges a card carries when it does not state its own. */
export const DEFAULT_CHARGES = 2;
/** Launcher band when the card states none (X-Wing missiles/torpedoes). */
const DEFAULT_LAUNCHER_BAND: readonly [number, number] = [2, 3];
/** Turret band when the card states none. */
const DEFAULT_TURRET_BAND: readonly [number, number] = [1, 2];

/** Missiles outrun every fighter (top speed 5 ≈ 460 px/s). */
export const MISSILE_SPEED_PX_PER_S = 700;
/** Torpedoes are slower but still outrun a fighter. */
export const TORPEDO_SPEED_PX_PER_S = 520;
/** A launcher's projectile burns out after this long (well past range 3). */
export const LAUNCHER_LIFETIME_MS = 2000;

/** Bombs detonate two maneuver cycles after the drop. */
export const BOMB_FUSE_MS = 2 * CYCLE_DURATION_MS;
/** Bomb blast reach: X-Wing range 0–1. */
export const BOMB_BLAST_RADIUS_PX = RANGE_1;
/** Mines can be set off one cycle after the drop. */
export const MINE_ARM_MS = CYCLE_DURATION_MS;
/** A ship whose centre comes this close to an armed mine touches it. */
export const MINE_TRIGGER_RADIUS_PX = 45;
/** Mine blast reach: the ship that touched it and anything alongside. */
export const MINE_BLAST_RADIUS_PX = 70;
/** An untouched mine fizzles after this long. */
export const MINE_LIFETIME_MS = 45_000;
/** Devices are dropped one speed-1 template plus half a base astern. */
export const DEVICE_DROP_DISTANCE_PX = SPEED_SCALE_FACTOR + 16;

/** Upper bound (px) of each X-Wing range band, band 0 = touching. */
const RANGE_BAND_EDGE_PX = [0, RANGE_1, RANGE_2, RANGE_3] as const;

/**
 * @param band - X-Wing range band [min, max], 1–3.
 * @returns The band in px: min = upper edge of the band below `min`.
 */
export function rangeBandPx(band: readonly [number, number]): RangeBandPx {
  const edge = (n: number): number =>
    RANGE_BAND_EDGE_PX[Math.max(0, Math.min(3, n))] ?? RANGE_3;
  return { minRangePx: edge(band[0] - 1), maxRangePx: edge(band[1]) };
}

/**
 * @param upgradeId - Upgrade catalog id.
 * @returns The card's weapon profile, slot type and name, or null.
 */
function weaponCard(upgradeId: string): {
  readonly name: string;
  readonly slotType: string;
  readonly weapon: WeaponProfile;
  readonly charges: number;
} | null {
  const card = UPGRADE_DEFINITIONS[upgradeId];
  if (!card?.weapon) return null;
  return {
    name: card.name,
    slotType: card.slotType,
    weapon: card.weapon,
    charges: card.effects?.chargesAdded ?? DEFAULT_CHARGES,
  };
}

/**
 * @param upgradeId - Upgrade catalog id.
 * @returns The secondary slot it fills (launcher or device), or null for
 *   any other card (cannons, turrets, crew…).
 */
export function secondarySpecOf(upgradeId: string): SecondarySpec | null {
  const card = weaponCard(upgradeId);
  if (!card) return null;
  const base: SlotSpecBase = {
    upgradeId,
    name: card.name,
    damage: card.weapon.damage * ORDNANCE_DAMAGE_SCALE,
    stressOnHit: card.weapon.stressOnHit ?? 0,
    cooldownMs: card.weapon.cooldownMs,
    charges: card.charges,
  };
  if (card.slotType === "missile" || card.slotType === "torpedo") {
    return launcherSpec(base, card.slotType, card.weapon);
  }
  if (card.slotType === "bomb") {
    return card.weapon.device === "mine" ? mineSpec(base) : bombSpec(base);
  }
  return null;
}

function launcherSpec(
  base: SlotSpecBase,
  kind: LauncherKind,
  weapon: WeaponProfile,
): LauncherSpec {
  return {
    ...base,
    kind,
    envelope: {
      ...rangeBandPx(weapon.rangeBand ?? DEFAULT_LAUNCHER_BAND),
      arcDeg: LAUNCH_ARC_DEG,
    },
    speedPxPerS:
      kind === "missile" ? MISSILE_SPEED_PX_PER_S : TORPEDO_SPEED_PX_PER_S,
    lifetimeMs: LAUNCHER_LIFETIME_MS,
    homingTurnRate: weapon.homingTurnRate ?? 0,
    homingTurnBudget: weapon.homingTurnBudget ?? 0,
    attackDice: weapon.damage,
  };
}

function bombSpec(base: SlotSpecBase): DeviceSpec {
  return {
    ...base,
    kind: "bomb",
    fuseMs: BOMB_FUSE_MS,
    armMs: 0,
    triggerRadiusPx: 0,
    blastRadiusPx: BOMB_BLAST_RADIUS_PX,
    lifetimeMs: BOMB_FUSE_MS,
  };
}

function mineSpec(base: SlotSpecBase): DeviceSpec {
  return {
    ...base,
    kind: "mine",
    fuseMs: 0,
    armMs: MINE_ARM_MS,
    triggerRadiusPx: MINE_TRIGGER_RADIUS_PX,
    blastRadiusPx: MINE_BLAST_RADIUS_PX,
    lifetimeMs: MINE_LIFETIME_MS,
  };
}

/**
 * @param upgradeIds - Equipped upgrades, in loadout order.
 * @returns The first turret card's rules, or null when none is equipped.
 */
export function turretSpecOf(
  upgradeIds: ReadonlyArray<string>,
): TurretSpec | null {
  for (const upgradeId of upgradeIds) {
    const card = weaponCard(upgradeId);
    if (!card || card.slotType !== "turret") continue;
    return {
      upgradeId,
      name: card.name,
      damage: card.weapon.damage,
      stressOnHit: card.weapon.stressOnHit ?? 0,
      cooldownMs: card.weapon.cooldownMs,
      envelope: {
        ...rangeBandPx(card.weapon.rangeBand ?? DEFAULT_TURRET_BAND),
        arcDeg: TURRET_ARC_DEG,
      },
    };
  }
  return null;
}
