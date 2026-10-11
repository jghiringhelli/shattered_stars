/**
 * BotView — what a bot pilot (and a squad leader) sees, built from plain
 * scene data: every other ship as a {@link BotContact}, its own ship
 * exactly. Scenes, the skill arena and the squad layer all go through these
 * builders, so the gates test exactly the view the game hands the bots.
 *
 * Pure: no Phaser.
 */

import { canBarrelRoll, canBoost, canKTurn } from "../../core/ArcadeControls";
import type { ManeuverDefinition } from "../../core/types";
import { CYCLE_DURATION_MS } from "../../config";
import type { CycleFlightState } from "../systems/CycleFlight";
import type { OwnShipView, SideKey, ShipSnapshot } from "./BotTypes";

/** A ship as a scene describes it to the AI (its current, true state). */
export interface BotContact {
  readonly id: string;
  readonly side: SideKey;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  /** Heading (°, 0 = up, clockwise). */
  readonly angle: number;
  readonly alive: boolean;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  /** Full width of the primary firing arc (°). */
  readonly firingArcDeg: number;
  /** Primary weapon range (px). */
  readonly weaponRange: number;
  /** Current throttle setting; omitted = unknown (0). */
  readonly speed?: number;
  /** Stressed pilot; omitted = false. */
  readonly isStressed?: boolean;
}

/**
 * @param contact - A ship as the scene describes it.
 * @returns What any pilot can see of it.
 */
export function contactSnapshot(contact: BotContact): ShipSnapshot {
  const max = contact.maxHull + contact.maxShields;
  return {
    id: contact.id,
    side: contact.side,
    definitionId: contact.definitionId,
    alive: contact.alive && contact.hull > 0,
    x: contact.x,
    y: contact.y,
    angle: contact.angle,
    speed: contact.speed ?? 0,
    healthFraction: max > 0 ? (contact.hull + contact.shields) / max : 0,
    isStressed: contact.isStressed ?? false,
    firingArcDeg: contact.firingArcDeg,
    weaponRange: contact.weaponRange,
  };
}

/** The pilot's own ship: its identity/stats, its flight and its dial. */
export interface OwnShipInput {
  readonly self: BotContact;
  readonly flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  /** False for hulls that cannot flip or dash (capitals): no specials/boost/roll. */
  readonly maneuverable: boolean;
}

/**
 * Everything a pilot knows exactly about its own ship. Pose, throttle and
 * stress come from the flight (the engine's truth), not the scene record.
 *
 * @param input - Own ship, flight, dial and whether it may flip or dash.
 * @returns The pilot's own-ship view.
 */
export function ownShipView(input: OwnShipInput): OwnShipView {
  const { motion, stress } = input.flight;
  const control = motion.control;
  const end = control.maneuverTarget;
  const pose = { x: motion.x, y: motion.y, angle: motion.angle };
  return {
    ...contactSnapshot({
      ...input.self,
      ...pose,
      speed: control.speed,
      isStressed: stress.isStressed,
    }),
    minSpeed: control.minSpeed,
    maxSpeed: control.maxSpeed,
    baseSize: control.baseSize,
    stressLevel: stress.level,
    dial: input.dial,
    msToCommit: (1 - control.maneuverProgress) * CYCLE_DURATION_MS,
    endPose: end ? { x: end.x, y: end.y, angle: end.angle } : pose,
    kturnReady: input.maneuverable && canKTurn(control),
    boostReady: input.maneuverable && canBoost(control),
    barrelRollReady: input.maneuverable && canBarrelRoll(control),
  };
}
