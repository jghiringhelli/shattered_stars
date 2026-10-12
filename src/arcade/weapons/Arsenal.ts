/**
 * Arsenal — one ship's secondary weapons, equipped from its quick build:
 * up to three launcher/device slots bound in loadout order (charges and
 * reload), an optional all-round turret, the slot FIRE_SECONDARY uses
 * (WEAPON_CYCLE moves it), the ship's target lock, and a cloak device only
 * when the ship's action bar carries "cloak".
 *
 * The ship's real-time modifiers are baked in at equip time: bonus charges,
 * reload multipliers, extra homing; no weapon reloads faster than one
 * attack per maneuver cycle (CombatTempo). Mutable by design: the battle
 * runtime owns each arsenal and updates it in place every frame.
 *
 * Pure: no Phaser.
 */

import type { CombatModifiers } from "../../core/CombatModifiers";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { attackIntervalMs } from "../systems/CombatTempo";
import { NO_LOCK, type LockState } from "./TargetLock";
import {
  secondarySpecOf,
  turretSpecOf,
  type SecondarySpec,
  type TurretSpec,
} from "./weaponSpecs";

/** Slots bound to the weapon selector, at most. */
export const MAX_SECONDARY_SLOTS = 3;
/** Seconds → ms. */
const MS_PER_S = 1000;
/** A cloak lasts this long before upgrades (Phantom Strike extends it). */
export const BASE_CLOAK_MS = 8000;
/** After a cloak ends, it takes this long before it can be used again. */
export const CLOAK_RECHARGE_MS = 15_000;

/** One launcher/device slot. */
export interface SlotState {
  readonly spec: SecondarySpec;
  charges: number;
  readonly maxCharges: number;
  /** Reload left before it may fire again (ms). */
  cooldownMs: number;
}

/** An all-round auto-tracking turret. */
export interface TurretState {
  readonly spec: TurretSpec;
  /** Current aim, ship-angle convention (0 = up, clockwise). */
  facingDeg: number;
  cooldownMs: number;
  /** A gunner aims it by hand (no auto-tracking). */
  manualAim: boolean;
}

/** A cloaking device (ships with the cloak action only). */
export interface CloakState {
  readonly durationMs: number;
  /** Time left cloaked (0 = visible). */
  activeMs: number;
  /** Time left before it can be engaged again. */
  rechargeMs: number;
}

/** One ship's secondary weapons. */
export interface Arsenal {
  readonly slots: SlotState[];
  /** Index FIRE_SECONDARY uses; -1 when the ship has no slot. */
  selected: number;
  readonly turret: TurretState | null;
  lock: LockState;
  readonly cloak: CloakState | null;
}

/** What a ship's arsenal is built from. */
export interface ArsenalLoadout {
  readonly definitionId: string;
  readonly upgradeIds: ReadonlyArray<string>;
  readonly modifiers: CombatModifiers;
}

/**
 * @param spec - A slot's card rules.
 * @param modifiers - The ship's modifier sheet.
 * @returns The rules with reload, charges and homing modifiers applied.
 */
function modifiedSpec(
  spec: SecondarySpec,
  modifiers: CombatModifiers,
): SecondarySpec {
  const cooldownMs = attackIntervalMs(
    spec.cooldownMs * modifiers.ordnanceCooldownMultiplier,
  );
  const charges = spec.charges + modifiers.ordnanceBonusCharges;
  if (spec.kind === "missile" || spec.kind === "torpedo") {
    return {
      ...spec,
      cooldownMs,
      charges,
      homingTurnBudget: spec.homingTurnBudget + modifiers.homingTurnBonus,
    };
  }
  return { ...spec, cooldownMs, charges };
}

function buildSlots(loadout: ArsenalLoadout): SlotState[] {
  const slots: SlotState[] = [];
  for (const upgradeId of loadout.upgradeIds) {
    if (slots.length >= MAX_SECONDARY_SLOTS) break;
    const card = secondarySpecOf(upgradeId);
    if (!card) continue;
    const spec = modifiedSpec(card, loadout.modifiers);
    slots.push({
      spec,
      charges: spec.charges,
      maxCharges: spec.charges,
      cooldownMs: 0,
    });
  }
  return slots;
}

function buildTurret(loadout: ArsenalLoadout): TurretState | null {
  const card = turretSpecOf(loadout.upgradeIds);
  if (!card) return null;
  const cooldownMs = attackIntervalMs(
    card.cooldownMs * loadout.modifiers.turretCooldownMultiplier,
  );
  return {
    spec: { ...card, cooldownMs },
    facingDeg: 0,
    cooldownMs: 0,
    manualAim: false,
  };
}

function buildCloak(loadout: ArsenalLoadout): CloakState | null {
  const actions: readonly string[] =
    getShipDefinition(loadout.definitionId)?.baseStats.actions ?? [];
  if (!actions.includes("cloak")) return null;
  return {
    durationMs: BASE_CLOAK_MS + loadout.modifiers.cloakDurationBonus * MS_PER_S,
    activeMs: 0,
    rechargeMs: 0,
  };
}

/**
 * @param loadout - Hull, upgrades and modifier sheet.
 * @returns The ship's arsenal, every slot loaded and ready.
 */
export function createArsenal(loadout: ArsenalLoadout): Arsenal {
  const slots = buildSlots(loadout);
  return {
    slots,
    selected: slots.length > 0 ? 0 : -1,
    turret: buildTurret(loadout),
    lock: NO_LOCK,
    cloak: buildCloak(loadout),
  };
}

/**
 * @param arsenal - A ship's arsenal.
 * @returns The selected slot, or null when the ship has none.
 */
export function selectedSlot(arsenal: Arsenal): SlotState | null {
  return arsenal.slots[arsenal.selected] ?? null;
}

/**
 * WEAPON_CYCLE: select the next slot (wrapping).
 *
 * @param arsenal - A ship's arsenal (mutated).
 * @returns The same arsenal.
 */
export function cycleSelection(arsenal: Arsenal): Arsenal {
  if (arsenal.slots.length > 0) {
    arsenal.selected = (arsenal.selected + 1) % arsenal.slots.length;
  }
  return arsenal;
}

/**
 * Count reloads, the turret and the cloak down by one frame.
 *
 * @param arsenal - A ship's arsenal (mutated).
 * @param deltaMs - Frame length (ms).
 */
export function tickArsenal(arsenal: Arsenal, deltaMs: number): void {
  for (const slot of arsenal.slots) {
    slot.cooldownMs = Math.max(0, slot.cooldownMs - deltaMs);
  }
  if (arsenal.turret) {
    arsenal.turret.cooldownMs = Math.max(
      0,
      arsenal.turret.cooldownMs - deltaMs,
    );
  }
  const cloak = arsenal.cloak;
  if (!cloak) return;
  if (cloak.activeMs > 0) {
    cloak.activeMs = Math.max(0, cloak.activeMs - deltaMs);
    if (cloak.activeMs === 0) cloak.rechargeMs = CLOAK_RECHARGE_MS;
    return;
  }
  cloak.rechargeMs = Math.max(0, cloak.rechargeMs - deltaMs);
}

/**
 * A gunner aims the turret by hand: it stops auto-tracking.
 *
 * @param arsenal - A ship's arsenal (mutated).
 * @param facingDeg - Aim, ship-angle convention.
 */
export function aimTurretBy(arsenal: Arsenal, facingDeg: number): void {
  const turret = arsenal.turret;
  if (!turret) return;
  turret.manualAim = true;
  turret.facingDeg = ((facingDeg % 360) + 360) % 360;
}

/**
 * @param arsenal - A ship's arsenal.
 * @returns True while its cloak is engaged.
 */
export function isCloaked(arsenal: Arsenal): boolean {
  return (arsenal.cloak?.activeMs ?? 0) > 0;
}

/**
 * Engage the cloak when the ship has one and it is recharged.
 *
 * @param arsenal - A ship's arsenal (mutated).
 * @returns True when the cloak engaged.
 */
export function startCloak(arsenal: Arsenal): boolean {
  const cloak = arsenal.cloak;
  if (!cloak || cloak.activeMs > 0 || cloak.rechargeMs > 0) return false;
  cloak.activeMs = cloak.durationMs;
  return true;
}

/**
 * Drop the cloak now (the ship fired); the recharge starts.
 *
 * @param arsenal - A ship's arsenal (mutated).
 */
export function endCloak(arsenal: Arsenal): void {
  const cloak = arsenal.cloak;
  if (!cloak || cloak.activeMs <= 0) return;
  cloak.activeMs = 0;
  cloak.rechargeMs = CLOAK_RECHARGE_MS;
}
