/**
 * weaponHud — the shared HUD model of secondary weapons and pilot feedback,
 * used by every battle scene's weapon bar:
 * - one slot per launcher/device (charges, reload sweep, lock ring on
 *   launchers, the selected slot marked with the FIRE_SECONDARY hint and
 *   the next one with the WEAPON_CYCLE hint), then the turret;
 * - the short label shown when FIRE_SECONDARY or a maneuver is refused.
 *
 * Pure: no Phaser.
 */

import type {
  Arsenal,
  CloakState,
  SlotState,
} from "../../arcade/weapons/Arsenal";
import { lockProgress } from "../../arcade/weapons/TargetLock";
import { isLauncher } from "../../arcade/weapons/weaponSpecs";
import type { FireOutcome } from "../../arcade/weapons/weaponTypes";
import type { FlightRefusal } from "../../arcade/systems/FlightCapabilities";
import type { WeaponSlotDescriptor } from "../../ui/hud/types";

/** Key hint on the slot FIRE_SECONDARY (Shift+Space) fires. */
export const FIRE_SECONDARY_HINT = "⇧␣";
/** Key hint on the slot WEAPON_CYCLE (Tab) selects next. */
export const NEXT_WEAPON_HINT = "⇥";
/** HUD id of the turret slot. */
export const TURRET_SLOT_ID = "turret";

/**
 * @param arsenal - The player's arsenal, or null.
 * @returns Weapon-bar slots for its secondaries and turret.
 */
export function secondaryWeaponSlots(
  arsenal: Readonly<Arsenal> | null,
): WeaponSlotDescriptor[] {
  if (!arsenal) return [];
  const count = arsenal.slots.length;
  const next = count > 1 ? (arsenal.selected + 1) % count : -1;
  const slots = arsenal.slots.map((slot, index) =>
    slotDescriptor(slot, index, arsenal, next),
  );
  const turret = arsenal.turret;
  if (turret) {
    slots.push({
      id: TURRET_SLOT_ID,
      kind: "turret",
      cooldown: fraction(turret.cooldownMs, turret.spec.cooldownMs),
      selected: false,
    });
  }
  return slots;
}

function slotDescriptor(
  slot: SlotState,
  index: number,
  arsenal: Readonly<Arsenal>,
  next: number,
): WeaponSlotDescriptor {
  const selected = index === arsenal.selected;
  const hint = selected
    ? FIRE_SECONDARY_HINT
    : index === next
      ? NEXT_WEAPON_HINT
      : undefined;
  const descriptor: WeaponSlotDescriptor = {
    id: `secondary-${index}`,
    kind: slot.spec.kind,
    charges: slot.charges,
    maxCharges: slot.maxCharges,
    cooldown: fraction(slot.cooldownMs, slot.spec.cooldownMs),
    selected,
    ...(hint === undefined ? {} : { keyHint: hint }),
  };
  return isLauncher(slot.spec)
    ? { ...descriptor, lock: lockProgress(arsenal.lock) }
    : descriptor;
}

function fraction(remainingMs: number, totalMs: number): number {
  if (!(totalMs > 0)) return 0;
  return Math.min(1, Math.max(0, remainingMs / totalMs));
}

const FIRE_LABELS: Readonly<Record<FireOutcome, string | null>> = {
  launched: null,
  dropped: null,
  no_weapon: "NO SECONDARY WEAPON",
  empty: "OUT OF AMMO",
  reloading: "RELOADING",
  no_target: "NO TARGET",
  locking: "NO LOCK",
  out_of_arc: "OUT OF ARC",
  out_of_range: "OUT OF RANGE",
  attacked: "LAUNCH QUEUED: NEXT CYCLE",
};

/**
 * @param outcome - What FIRE_SECONDARY did.
 * @returns The label to flash, or null when it fired.
 */
export function fireOutcomeLabel(outcome: FireOutcome): string | null {
  return FIRE_LABELS[outcome];
}

/**
 * @param cloak - The ship's cloak device, or null when it has none.
 * @returns Why CLOAK did nothing.
 */
export function cloakRefusalLabel(cloak: CloakState | null): string {
  return cloak ? "CLOAK RECHARGING" : "NO CLOAKING DEVICE";
}

const ACTION_NAMES: Readonly<Record<FlightRefusal["action"], string>> = {
  kturn: "SNAP",
  segnor: "HOOK LOOP",
  tallon: "KNIFE ROLL",
  boost: "BOOST",
  barrel_roll: "BARREL ROLL",
};

/**
 * @param refusal - A refused special or dash.
 * @returns The label to flash.
 */
export function refusalLabel(refusal: FlightRefusal): string {
  const name = ACTION_NAMES[refusal.action];
  switch (refusal.reason) {
    case "stressed":
      return `STRESSED: NO ${name}`;
    case "not_on_dial":
      return `${name} NOT ON DIAL`;
    case "no_action":
      return `NO ${name} ACTION`;
  }
}
