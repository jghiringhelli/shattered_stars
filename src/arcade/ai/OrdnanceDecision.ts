/**
 * OrdnanceDecision — a bot's use of its secondary weapons, decided each
 * frame by the shared secondary-weapons runtime (injected as its decider):
 *
 * 1. Launchers: fire a missile/torpedo only when the shot is legal — the
 *    pilot's target locked and inside the launcher's band and front arc
 *    (the same check the human's FIRE_SECONDARY gets).
 * 2. Devices: drop a bomb/mine only when an enemy is close astern (behind
 *    or crossing the tail) and no friend would be caught in the blast —
 *    devices never go "forward".
 * 3. Cloak: a ship with a cloak engages it when an enemy has it in its
 *    front arc at close range.
 *
 * Turrets need no decision: they track and fire on their own. Pure.
 */

import type { Arsenal, SlotState } from "../weapons/Arsenal";
import { checkSecondaryFire } from "../weapons/FireControl";
import {
  bearingOffNoseDeg,
  inArcEnvelope,
  pointAstern,
  torusRangePx,
} from "../weapons/FiringGeometry";
import {
  DEVICE_DROP_DISTANCE_PX,
  LAUNCH_ARC_DEG,
  isLauncher,
} from "../weapons/weaponSpecs";
import type {
  OrdnanceDecision,
  OrdnanceView,
  WeaponBody,
} from "../weapons/weaponTypes";
import { RANGE_2 } from "../../config";

/** An enemy at least this far off the nose counts as astern (degrees). */
export const ASTERN_BEARING_DEG = 120;
/** Drop a mine at an enemy astern within this range (px). */
export const MINE_DROP_RANGE_PX = 220;
/** Drop a bomb at an enemy astern within this range (px). */
export const BOMB_DROP_RANGE_PX = 180;
/** Keep friends this many blast radii clear of a drop. */
export const FRIENDLY_CLEARANCE_FACTOR = 1.5;
/** Cloak when an enemy within this range has the ship in its front arc. */
export const CLOAK_THREAT_RANGE_PX = RANGE_2;

/**
 * @param view - What the bot sees.
 * @returns The ordnance it uses this frame, or null.
 */
export function decideOrdnance(view: OrdnanceView): OrdnanceDecision {
  const { arsenal } = view;
  for (let slot = 0; slot < arsenal.slots.length; slot++) {
    const state = arsenal.slots[slot] as SlotState;
    if (state.charges <= 0 || state.cooldownMs > 0) continue;
    if (
      isLauncher(state.spec)
        ? launchIsLegal(view, state)
        : dropIsWorthIt(view, state)
    ) {
      return { kind: "fire", slot };
    }
  }
  return shouldCloak(view, arsenal) ? { kind: "cloak" } : null;
}

function launchIsLegal(view: OrdnanceView, slot: SlotState): boolean {
  return (
    checkSecondaryFire(
      slot,
      view.arsenal.lock,
      view.self,
      view.target,
      view.worldSize,
    ) === "launched"
  );
}

function dropIsWorthIt(view: OrdnanceView, slot: SlotState): boolean {
  if (isLauncher(slot.spec)) return false;
  const reach =
    slot.spec.kind === "mine" ? MINE_DROP_RANGE_PX : BOMB_DROP_RANGE_PX;
  const enemyAstern = view.enemies.some((enemy) =>
    isAstern(view.self, enemy, reach, view.worldSize),
  );
  if (!enemyAstern) return false;
  const dropPoint = pointAstern(
    view.self,
    DEVICE_DROP_DISTANCE_PX,
    view.worldSize,
  );
  const clearance = slot.spec.blastRadiusPx * FRIENDLY_CLEARANCE_FACTOR;
  return !view.allies.some(
    (ally) => torusRangePx(dropPoint, ally, view.worldSize) < clearance,
  );
}

function isAstern(
  self: WeaponBody,
  enemy: WeaponBody,
  reachPx: number,
  worldSize: number,
): boolean {
  if (torusRangePx(self, enemy, worldSize) > reachPx) return false;
  return (
    Math.abs(bearingOffNoseDeg(self, enemy, worldSize)) >= ASTERN_BEARING_DEG
  );
}

function shouldCloak(view: OrdnanceView, arsenal: Readonly<Arsenal>): boolean {
  const cloak = arsenal.cloak;
  if (!cloak || cloak.activeMs > 0 || cloak.rechargeMs > 0) return false;
  return view.enemies.some((enemy) =>
    inArcEnvelope(
      enemy,
      view.self,
      { maxRangePx: CLOAK_THREAT_RANGE_PX, arcDeg: LAUNCH_ARC_DEG },
      view.worldSize,
    ),
  );
}
