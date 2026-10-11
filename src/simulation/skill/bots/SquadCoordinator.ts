/**
 * SquadCoordinator — the shared tactical layer of a coordinated squadron:
 * - focus fire: the whole squad attacks one enemy (the weakest, nearest to
 *   the squad), switching only when another is clearly better;
 * - cohesion: while the squad is spread out and the focus is not yet in
 *   reach, everyone forms up on the squad's centre first, so the squad
 *   arrives together and fights several-on-one;
 * - flanking (optional): each pilot approaches the focus from its own slot
 *   (astern, rear quarters, beams) so the target can face at most one;
 * - drag and bag: an enemy sitting on a squadmate's six becomes the focus,
 *   and the victim drags it toward the squad's guns;
 * - support: each pilot knows its nearest wingman to stay close to;
 * - fall back: a badly damaged pilot regroups on the squad.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../../../config";
import {
  inFiringArc,
  offNoseDeg,
  signedAngle,
  torusOffset,
  unwrapNear,
  type Point,
} from "../ArenaGeometry";
import type {
  PerceivedShip,
  ShipSnapshot,
  SquadBrain,
  SquadOrder,
} from "../SkillTypes";
import { TIER_PROFILES } from "./BotKit";

/** Flank slots in assignment order (° relative to the target's heading). */
export const FLANK_BEARINGS_DEG: readonly number[] = [
  180, 135, -135, 90, -90, 160, -160, 110,
];

/** Below this health a pilot falls back on the squad. */
export const FALLBACK_HEALTH = 0.3;

/** Focus score units per pixel from the squad's centre. */
export const FOCUS_DISTANCE_WEIGHT = 1 / 1000;

/** Score credit the current focus keeps (hysteresis against flip-flopping). */
export const FOCUS_STICKINESS = 0.3;

/** The squad counts as spread out when a pilot is this far from its centre (px). */
export const COHESION_SPREAD_PX = 220;

/** Cohesion only applies while the focus is farther than this from the squad's centre (px). */
export const COHESION_ENGAGE_RANGE_PX = 600;

/** The form-up point sits this far from the centre toward the focus (px). */
export const RALLY_LEAD_PX = 150;

/** Which coordination behaviours a squad uses. */
export interface CoordinationOptions {
  readonly cohesion: boolean;
  readonly flanking: boolean;
  /** Focus the enemy on a squadmate's six; the victim drags it to the squad. */
  readonly dragAndBag: boolean;
}

/** An enemy attacking squadmates. */
interface Bandit {
  readonly enemy: PerceivedShip;
  readonly victims: readonly string[];
}

/** Cohesion, flanking and drag-and-bag all on (focus fire is always on). */
export const DEFAULT_COORDINATION: CoordinationOptions = {
  cohesion: true,
  flanking: true,
  dragAndBag: true,
};

export class SquadCoordinator implements SquadBrain {
  private focusId: string | null = null;

  /**
   * @param reactionMs - Delay of the squad's shared picture (ms).
   * @param options - Coordination behaviours in use.
   * @param worldSize - Torus edge (px).
   */
  constructor(
    readonly reactionMs: number = TIER_PROFILES.average.reactionMs,
    private readonly options: CoordinationOptions = DEFAULT_COORDINATION,
    private readonly worldSize: number = BATTLEFIELD_SIZE,
  ) {}

  /**
   * @param own - The squad's living ships.
   * @param enemies - Living enemies as perceived.
   * @returns One order per own ship.
   */
  plan(
    own: readonly ShipSnapshot[],
    enemies: readonly PerceivedShip[],
  ): ReadonlyMap<string, SquadOrder> {
    const orders = new Map<string, SquadOrder>();
    if (own.length === 0 || enemies.length === 0) return orders;
    const centre = centroid(own, this.worldSize);
    const bandit = this.options.dragAndBag
      ? this.banditOnASix(own, enemies, centre)
      : null;
    const focus = bandit?.enemy ?? this.pickFocus(centre, enemies);
    this.focusId = focus.id;
    const slots = this.options.flanking
      ? assignSlots(own, focus, this.worldSize)
      : new Map<string, number>();
    const rallyPoint = this.options.cohesion
      ? this.rallyPoint(own, centre, focus)
      : null;
    for (const ship of own) {
      const damaged = ship.healthFraction < FALLBACK_HEALTH;
      orders.set(ship.id, {
        focusTargetId: focus.id,
        approachBearingDeg: slots.get(ship.id) ?? null,
        supportAllyId: nearestOther(ship, own, this.worldSize)?.id ?? null,
        rallyPoint,
        fallBack:
          own.length > 1 &&
          (damaged || bandit?.victims.includes(ship.id) === true),
      });
    }
    return orders;
  }

  /**
   * The enemy sitting on a squadmate's six (squadmate in its arc and range),
   * nearest the squad's centre — the one to sandwich.
   * @param own - The squad's living ships.
   * @param enemies - Living enemies as perceived.
   * @param centre - The squad's centre.
   * @returns That enemy and the squadmates it threatens, or null.
   */
  private banditOnASix(
    own: readonly ShipSnapshot[],
    enemies: readonly PerceivedShip[],
    centre: Point,
  ): Bandit | null {
    let best: Bandit | null = null;
    let bestDistance = Infinity;
    for (const enemy of enemies) {
      const victims = own
        .filter((ship) => inFiringArc(enemy, ship, this.worldSize))
        .map((ship) => ship.id);
      if (victims.length === 0) continue;
      const distance = torusOffset(centre, enemy, this.worldSize).distance;
      if (distance < bestDistance) {
        best = { enemy, victims };
        bestDistance = distance;
      }
    }
    return best;
  }

  /**
   * @param centre - The squad's centre.
   * @param enemies - Living enemies as perceived.
   * @returns The enemy the squad attacks: weak and close to the squad.
   */
  private pickFocus(
    centre: Point,
    enemies: readonly PerceivedShip[],
  ): PerceivedShip {
    let best = enemies[0]!;
    let bestScore = Infinity;
    for (const enemy of enemies) {
      const distance = torusOffset(centre, enemy, this.worldSize).distance;
      const sticky = enemy.id === this.focusId ? FOCUS_STICKINESS : 0;
      const score =
        enemy.healthFraction + distance * FOCUS_DISTANCE_WEIGHT - sticky;
      if (score < bestScore) {
        best = enemy;
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * @param own - The squad's living ships.
   * @param centre - The squad's centre.
   * @param focus - The focus target.
   * @returns Where a spread-out squad forms up before engaging, or null to engage.
   */
  private rallyPoint(
    own: readonly ShipSnapshot[],
    centre: Point,
    focus: PerceivedShip,
  ): Point | null {
    if (own.length < 2) return null;
    const toFocus = torusOffset(centre, focus, this.worldSize);
    if (toFocus.distance <= COHESION_ENGAGE_RANGE_PX) return null;
    const spread = Math.max(
      ...own.map((s) => torusOffset(centre, s, this.worldSize).distance),
    );
    if (spread <= COHESION_SPREAD_PX) return null;
    const lead = RALLY_LEAD_PX / toFocus.distance;
    return { x: centre.x + toFocus.dx * lead, y: centre.y + toFocus.dy * lead };
  }
}

/**
 * Give each pilot a flank slot: the one nearest its current bearing around
 * the target, pilots already nearest astern choosing first.
 * @param own - The squad's ships.
 * @param focus - The focus target.
 * @param worldSize - Torus edge (px).
 * @returns Slot bearing per ship id.
 */
export function assignSlots(
  own: readonly ShipSnapshot[],
  focus: PerceivedShip,
  worldSize: number,
): Map<string, number> {
  const free = FLANK_BEARINGS_DEG.slice(0, Math.max(1, own.length));
  const bearings = own
    .map((ship) => ({
      id: ship.id,
      bearing: offNoseDeg(focus, ship, worldSize),
    }))
    .sort(
      (a, b) =>
        Math.abs(signedAngle(a.bearing - 180)) -
        Math.abs(signedAngle(b.bearing - 180)),
    );
  const slots = new Map<string, number>();
  for (const { id, bearing } of bearings) {
    let pick = 0;
    for (let i = 1; i < free.length; i++) {
      if (
        Math.abs(signedAngle(free[i]! - bearing)) <
        Math.abs(signedAngle(free[pick]! - bearing))
      )
        pick = i;
    }
    slots.set(id, free[pick] ?? FLANK_BEARINGS_DEG[0]!);
    if (free.length > 1) free.splice(pick, 1);
  }
  return slots;
}

/**
 * @param ships - The squad.
 * @param worldSize - Torus edge (px).
 * @returns The torus centroid of the ships (unwrapped around the first).
 */
function centroid(ships: readonly ShipSnapshot[], worldSize: number): Point {
  const anchor = ships[0]!;
  let x = 0;
  let y = 0;
  for (const ship of ships) {
    const near = unwrapNear(anchor, ship, worldSize);
    x += near.x;
    y += near.y;
  }
  return { x: x / ships.length, y: y / ships.length };
}

/**
 * @param ship - The pilot.
 * @param own - The squad.
 * @param worldSize - Torus edge (px).
 * @returns The nearest other ship of the squad, or null when alone.
 */
function nearestOther(
  ship: ShipSnapshot,
  own: readonly ShipSnapshot[],
  worldSize: number,
): ShipSnapshot | null {
  let best: ShipSnapshot | null = null;
  let bestDistance = Infinity;
  for (const other of own) {
    if (other.id === ship.id) continue;
    const distance = torusOffset(ship, other, worldSize).distance;
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}
