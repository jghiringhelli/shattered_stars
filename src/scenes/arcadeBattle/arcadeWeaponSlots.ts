/**
 * arcadeWeaponSlots — the Skirmish weapon bar as plain slot descriptors:
 * primary laser (cooling for the rest of the cycle once fired), each
 * ordnance slot with charges and reload, then the turret, with key hints.
 * Pure: no Phaser.
 */

import type { ArcadeOrdnanceSlot } from "../../arcade/ArcadeOrdnance";
import type { ArcadeTurretSlot } from "../../arcade/ArcadeTurret";
import type { ShipControlState } from "../../core/ArcadeControls";
import type { WeaponKind, WeaponSlotDescriptor } from "../../ui/hud/types";

/** Key hint on the slot WEAPON_CYCLE (Tab) selects next. */
export const NEXT_WEAPON_HINT = "⇥";
/** Key hint on bomb slots (Shift+Space drops one behind the ship). */
export const BOMB_HINT = "⇧␣";
/** Key hint on the turret slot (G switches to gunner). */
export const TURRET_HINT = "G";

/** What the weapon bar reads of a ship. */
export interface WeaponShipView {
  readonly control: ShipControlState;
  readonly ordnanceSlots: ReadonlyArray<ArcadeOrdnanceSlot>;
  readonly turretSlot: ArcadeTurretSlot | null;
}

/**
 * Weapon bar slots: primary laser, each ordnance slot, then the turret.
 *
 * @param ship - The player's ship.
 * @param selectedSlot - -1 for the laser, else the selected ordnance index.
 * @returns Slot descriptors, left to right.
 */
export function toWeaponSlots(
  ship: WeaponShipView,
  selectedSlot: number,
): WeaponSlotDescriptor[] {
  const nextSlot = nextWeaponSlot(selectedSlot, ship.ordnanceSlots.length);
  const primaryCooldown = ship.control.firedLaserThisCycle
    ? clampFraction(1 - ship.control.maneuverProgress)
    : 0;
  const slots: WeaponSlotDescriptor[] = [
    withHint(
      {
        id: "primary",
        kind: "primary",
        cooldown: primaryCooldown,
        selected: selectedSlot < 0,
      },
      nextSlot === -1 ? NEXT_WEAPON_HINT : undefined,
    ),
  ];
  ship.ordnanceSlots.forEach((slot, index) => {
    slots.push(ordnanceSlotDescriptor(slot, index, selectedSlot, nextSlot));
  });
  if (ship.turretSlot) slots.push(turretDescriptor(ship.turretSlot));
  return slots;
}

/**
 * Where WEAPON_CYCLE goes from the current selection (laser → 0 → … → laser).
 *
 * @param selectedSlot - -1 for the laser, else an ordnance index.
 * @param ordnanceCount - Number of ordnance slots.
 * @returns The next selection, or null when there is no ordnance to cycle.
 */
export function nextWeaponSlot(
  selectedSlot: number,
  ordnanceCount: number,
): number | null {
  if (ordnanceCount === 0) return null;
  return selectedSlot >= ordnanceCount - 1 ? -1 : selectedSlot + 1;
}

function ordnanceSlotDescriptor(
  slot: ArcadeOrdnanceSlot,
  index: number,
  selectedSlot: number,
  nextSlot: number | null,
): WeaponSlotDescriptor {
  const isBomb = slot.ordnanceClass === "bomb";
  const hint = isBomb
    ? BOMB_HINT
    : nextSlot === index
      ? NEXT_WEAPON_HINT
      : undefined;
  return withHint(
    {
      id: `ordnance-${index}`,
      kind: slot.ordnanceClass satisfies WeaponKind,
      charges: slot.charges,
      maxCharges: slot.maxCharges,
      cooldown: cooldownFraction(slot.cooldownRemaining, slot.cooldownMax),
      selected: selectedSlot === index,
    },
    hint,
  );
}

function turretDescriptor(turret: ArcadeTurretSlot): WeaponSlotDescriptor {
  return {
    id: "turret",
    kind: "turret",
    cooldown: cooldownFraction(turret.cooldownRemaining, turret.cooldownMax),
    selected: false,
    keyHint: TURRET_HINT,
  };
}

function withHint(
  slot: WeaponSlotDescriptor,
  hint: string | undefined,
): WeaponSlotDescriptor {
  return hint === undefined ? slot : { ...slot, keyHint: hint };
}

/**
 * @param remainingMs - Cooldown left.
 * @param totalMs - Full cooldown.
 * @returns Remaining fraction in [0, 1] (0 when the cooldown is instant).
 */
export function cooldownFraction(remainingMs: number, totalMs: number): number {
  if (!(totalMs > 0)) return 0;
  return clampFraction(remainingMs / totalMs);
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Everything needed to build one frame of the battle HUD. */
