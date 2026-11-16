/**
 * AceStrikePolicy — how an ACE's bot flies hit-and-run (spec:
 * docs/specs/aces.md). It wraps any tier's bot, for ace ships only:
 *
 * 1. TARGET — prefers the squad's marked target and isolated enemies, and
 *    approaches on the target's rear flank, never head-on (AceTargeting).
 * 2. DIVE — boosts in from just outside weapon range when the target is
 *    ahead and cannot shoot back: the dash opens the strike window.
 * 3. ROLL OUT — barrel-rolls out of the arcs of enemies that have it in
 *    their sights while it cannot shoot back (the disengage reward).
 * 4. BREAK OFF — when hurt and under fire (after one attack), or when
 *    outnumbered in the spot after a burst, it flies away at full throttle,
 *    boosting out, and re-enters when the range is open.
 *
 * The memory is a plain record held by the BotPilot, so lockstep snapshots
 * capture it. Pure: no Phaser, no clock of its own, no randomness.
 */

import {
  ACE_BOOST_MAX_STRESS,
  ACE_BREAK_OFF_HEALTH,
  ACE_BURST_MS,
  ACE_DISENGAGE_MAX_MS,
  ACE_DISENGAGE_MS,
  ACE_DIVE_BEARING_DEG,
  ACE_DIVE_EXTRA_RANGE_PX,
  ACE_LOW_HEALTH_BURST_MS,
  ACE_OUTNUMBERED_THREATS,
  ACE_REENTRY_RANGE_PX,
} from "../../data/aceConfig";
import { inFiringArc, offNoseDeg, torusOffset } from "./AiGeometry";
import type { PerceivedShip, PilotIntent, PilotView } from "./BotTypes";
import { steerForError, type SteerThresholds } from "./bots/BotKit";
import { rollSideOutOfArcs } from "./bots/ExpertBot";

/** Steering while breaking away: turn hard and early. */
export const ACE_ESCAPE_STEER: SteerThresholds = {
  hold: 10,
  drift: 25,
  bank: 50,
};

/** Heading error within which a disengaging ace boosts out (°). */
const ESCAPE_BOOST_BEARING_DEG = 60;

/** Longest decision gap counted as contact time (ms): a stall is not a burst. */
const MAX_CONTACT_STEP_MS = 500;

/** Where an ace is in its strike rhythm. */
export type AcePhase = "approach" | "disengage";

/** What an ace's bot remembers between decisions. */
export interface AceMemory {
  phase: AcePhase;
  /** Pilot clock (ms) when the phase began. */
  phaseStartMs: number;
  /** Time the target has been in the ace's weapon arc this approach (ms). */
  contactMs: number;
  /** Pilot clock of the previous decision, or null before the first. */
  lastDecisionMs: number | null;
}

/** @returns A fresh memory: approaching, no contact yet. */
export function createAceMemory(): AceMemory {
  return {
    phase: "approach",
    phaseStartMs: 0,
    contactMs: 0,
    lastDecisionMs: null,
  };
}

/**
 * @param view - What the ace perceives.
 * @param target - Its target.
 * @returns Whether the target is in the ace's weapon arc and range.
 */
function inContact(view: PilotView, target: PerceivedShip): boolean {
  return inFiringArc(view.self, target, view.worldSize);
}

/**
 * Advance the strike rhythm one decision.
 * @param view - What the ace perceives.
 * @param target - The ace's target.
 * @param memory - The ace's memory (mutated).
 */
function advancePhase(
  view: PilotView,
  target: PerceivedShip,
  memory: AceMemory,
): void {
  const now = view.nowMs;
  const step = Math.min(
    MAX_CONTACT_STEP_MS,
    memory.lastDecisionMs === null ? 0 : now - memory.lastDecisionMs,
  );
  memory.lastDecisionMs = now;
  const elapsed = now - memory.phaseStartMs;
  const distance = torusOffset(view.self, target, view.worldSize).distance;
  if (memory.phase === "disengage") {
    const clear = elapsed >= ACE_DISENGAGE_MS && distance >= ACE_REENTRY_RANGE_PX;
    if (clear || elapsed >= ACE_DISENGAGE_MAX_MS) {
      memory.phase = "approach";
      memory.phaseStartMs = now;
      memory.contactMs = 0;
    }
    return;
  }
  if (inContact(view, target)) memory.contactMs += step;
  const threats = threatCount(view);
  const hurt = view.self.healthFraction <= ACE_BREAK_OFF_HEALTH;
  const underFire = hurt
    ? threats >= 1 && memory.contactMs >= ACE_LOW_HEALTH_BURST_MS
    : threats >= ACE_OUTNUMBERED_THREATS && memory.contactMs >= ACE_BURST_MS;
  if (underFire) {
    memory.phase = "disengage";
    memory.phaseStartMs = now;
  }
}

/**
 * @param view - What the ace perceives.
 * @returns How many enemies have the ace in their firing arc and range.
 */
function threatCount(view: PilotView): number {
  return view.enemies.filter((enemy) =>
    inFiringArc(enemy, view.self, view.worldSize),
  ).length;
}

/**
 * Fly away from the target: turn hard away, full throttle, boost out once
 * pointing away.
 * @param view - What the ace perceives.
 * @param target - The ace's target.
 * @param intent - What the underlying bot wanted (its target is kept).
 * @returns The break-away intent.
 */
function disengageIntent(
  view: PilotView,
  target: PerceivedShip,
  intent: PilotIntent,
): PilotIntent {
  const { self } = view;
  const toTarget = torusOffset(self, target, view.worldSize);
  const awayPoint = { x: self.x - toTarget.dx, y: self.y - toTarget.dy };
  const error = offNoseDeg(self.endPose, awayPoint, view.worldSize);
  const pointingAway = Math.abs(error) <= ESCAPE_BOOST_BEARING_DEG;
  return {
    maneuver: steerForError(error, ACE_ESCAPE_STEER, self.isStressed),
    special: null,
    targetSpeed: self.maxSpeed,
    boost: pointingAway && self.boostReady && self.stressLevel < ACE_BOOST_MAX_STRESS,
    barrelRoll: null,
    targetId: intent.targetId,
  };
}

/**
 * @param view - What the ace perceives.
 * @param target - The ace's target.
 * @returns Whether the ace should dive now: target ahead, just out of
 *   weapon range and unable to shoot back, boost ready and calm pilot.
 */
function shouldDive(view: PilotView, target: PerceivedShip): boolean {
  const { self, worldSize } = view;
  const distance = torusOffset(self, target, worldSize).distance;
  const ahead = Math.abs(offNoseDeg(self, target, worldSize)) < ACE_DIVE_BEARING_DEG;
  const outsideItsArc =
    Math.abs(offNoseDeg(target, self, worldSize)) >= target.firingArcDeg / 2;
  return (
    self.boostReady &&
    self.stressLevel < ACE_BOOST_MAX_STRESS &&
    ahead &&
    outsideItsArc &&
    distance > self.weaponRange &&
    distance <= self.weaponRange + ACE_DIVE_EXTRA_RANGE_PX
  );
}

/**
 * Slip out of the arcs of enemies that have the ace in their sights while it
 * cannot shoot back: a barrel roll to the side that leaves every arc.
 * @param view - What the ace perceives.
 * @param target - The ace's target.
 * @returns The roll side, or null when there is no need or no good side.
 */
function rollOutSide(
  view: PilotView,
  target: PerceivedShip,
): "left" | "right" | null {
  const { self, worldSize } = view;
  if (!self.barrelRollReady || self.stressLevel >= ACE_BOOST_MAX_STRESS)
    return null;
  if (inFiringArc(self, target, worldSize)) return null;
  const threats = view.enemies.filter((enemy) =>
    inFiringArc(enemy, self, worldSize),
  );
  return threats.length > 0 ? rollSideOutOfArcs(self, threats, worldSize) : null;
}

/**
 * The ace's intent for this decision: what its tier's bot wanted, turned
 * into dive / roll-out / disengage. With no target nothing changes.
 *
 * @param view - What the ace perceives (the view its bot decided on).
 * @param intent - The tier bot's intent.
 * @param memory - The ace's memory (mutated).
 * @returns The intent its hands carry out.
 */
export function aceStrikeIntent(
  view: PilotView,
  intent: PilotIntent,
  memory: AceMemory,
): PilotIntent {
  const target = view.enemies.find((enemy) => enemy.id === intent.targetId);
  if (!target) return intent;
  advancePhase(view, target, memory);
  if (memory.phase === "disengage") return disengageIntent(view, target, intent);
  if (intent.boost || intent.barrelRoll) return intent;
  if (shouldDive(view, target)) return { ...intent, boost: true };
  const roll = rollOutSide(view, target);
  return roll ? { ...intent, barrelRoll: roll } : intent;
}
