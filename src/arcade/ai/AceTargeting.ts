/**
 * AceTargeting — what an ace goes for and from where (the TARGET half of
 * AceStrikePolicy, docs/specs/aces.md): the squad's marked target and
 * isolated enemies are preferred over the merely nearest one, and the
 * approach is on the target's rear flank, never head-on.
 *
 * Pure: no Phaser, no randomness.
 */

import {
  ACE_APPROACH_BEARING_DEG,
  ACE_ISOLATED_TARGET_BONUS_PX,
  ACE_ISOLATION_RADIUS_PX,
  ACE_MARKED_TARGET_BONUS_PX,
} from "../../data/aceConfig";
import { offNoseDeg, torusOffset } from "./AiGeometry";
import type { PerceivedShip, PilotView, SquadOrder } from "./BotTypes";

/** An order that changes nothing but what the ace overrides. */
const BLANK_ORDER: SquadOrder = {
  focusTargetId: null,
  approachBearingDeg: null,
  supportAllyId: null,
  rallyPoint: null,
  fallBack: false,
};

/**
 * @param enemy - A candidate target.
 * @param enemies - Every enemy the ace perceives.
 * @param worldSize - Torus edge (px).
 * @returns Whether no other enemy flies within the isolation radius.
 */
function isIsolated(
  enemy: PerceivedShip,
  enemies: readonly PerceivedShip[],
  worldSize: number,
): boolean {
  return enemies.every(
    (other) =>
      other.id === enemy.id ||
      torusOffset(enemy, other, worldSize).distance > ACE_ISOLATION_RADIUS_PX,
  );
}

/**
 * The enemy an ace goes for: the nearest, discounted when it is the squad's
 * marked target (the order's focus) or isolated.
 * @param view - What the ace perceives.
 * @returns The preferred target's id, or null with no enemy.
 */
export function preferredAceTargetId(view: PilotView): string | null {
  let best: string | null = null;
  let bestCost = Infinity;
  for (const enemy of view.enemies) {
    const distance = torusOffset(view.self, enemy, view.worldSize).distance;
    const marked = enemy.id === view.order?.focusTargetId;
    const isolated = isIsolated(enemy, view.enemies, view.worldSize);
    const cost =
      distance -
      (marked ? ACE_MARKED_TARGET_BONUS_PX : 0) -
      (isolated ? ACE_ISOLATED_TARGET_BONUS_PX : 0);
    if (cost < bestCost) {
      best = enemy.id;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * The view an ace's own bot decides on: its preferred target as the focus,
 * and a rear-flank approach on the side it already sits on (the squad's own
 * flank slot is kept).
 * @param view - What the ace perceives.
 * @returns The view with the order adjusted (the input when no enemy lives).
 */
export function aceStrikeView(view: PilotView): PilotView {
  const targetId = preferredAceTargetId(view);
  const target = view.enemies.find((enemy) => enemy.id === targetId);
  if (!target) return view;
  const order = view.order ?? BLANK_ORDER;
  const side = offNoseDeg(target, view.self, view.worldSize) >= 0 ? 1 : -1;
  return {
    ...view,
    order: {
      ...order,
      focusTargetId: target.id,
      approachBearingDeg:
        order.approachBearingDeg ?? side * ACE_APPROACH_BEARING_DEG,
    },
  };
}
