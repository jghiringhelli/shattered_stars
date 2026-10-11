/**
 * AverageBot — a competent club pilot. It reacts in a quarter second with
 * moderate misjudgement and reads the dial ONE cycle ahead while engaging
 * (the expert's planner, shallow: no follow-up cycle, no mid-cycle check,
 * a weaker sense of danger, no barrel-roll / boost reflexes). Getting to the
 * fight it flies by rule: leads its target a little, picks the dial maneuver
 * nearest the heading error, opens the throttle to close distance and
 * occasionally K-turns onto a target that slipped behind.
 *
 * Follows squad orders when it has them: attacks the focus target (from its
 * flank slot), forms up with the squad before engaging, regroups when
 * damaged or dragging an attacker, stays near its wingman when idle.
 *
 * Pure: no Phaser.
 */

import { offNoseDeg, torusOffset, type Point } from "../AiGeometry";
import {
  IDLE_INTENT,
  type BotProfile,
  type PerceivedShip,
  type PilotBot,
  type PilotIntent,
  type PilotView,
  type SpecialManeuver,
  type SteerManeuver,
} from "../BotTypes";
import {
  judgedHeadingError,
  leadPoint,
  nearestShip,
  noise,
  steerForError,
  TIER_PROFILES,
  type SteerThresholds,
} from "./BotKit";
import {
  EXPERT_WEIGHTS,
  planManeuver,
  type PlanWeights,
} from "./ManeuverPlanner";

/**
 * An average pilot's steering by rule: the dial maneuver nearest the error
 * (midpoints between straight 0°, drift 30°, bank 45°, turn 90°).
 */
export const AVERAGE_STEER: SteerThresholds = { hold: 15, drift: 37, bank: 67 };

/** Reading the dial one cycle ahead, with less fear of enemy arcs than an ace. */
export const AVERAGE_WEIGHTS: PlanWeights = {
  ...EXPERT_WEIGHTS,
  danger: 4,
  rear: 2,
  followUp: 0,
  midCycle: 0,
};

/** Within this many weapon ranges of its target the pilot reads the dial (engages). */
export const AVERAGE_ENGAGE_RANGES = 2;

/** "Dead ahead" for the full-throttle chase (°). */
export const AVERAGE_CHASE_BEARING_DEG = 30;

/** A target this far off the nose counts as behind: K-turn candidate (°). */
export const AVERAGE_KTURN_ERROR_DEG = 150;

/** Only K-turn onto a target this close (px). */
export const AVERAGE_KTURN_RANGE_PX = 450;

/** Chance per decision that the pilot thinks of the K-turn. */
export const AVERAGE_KTURN_CHANCE = 0.35;

/** Lead the target by this much (ms). */
export const AVERAGE_LEAD_MS = 250;

/** Beyond this range a pilot with a flank slot flies to the slot first (px). */
export const FLANK_COMMIT_RANGE_PX = 450;

/** How far off the target a flank slot sits (px). */
export const FLANK_SLOT_DISTANCE_PX = 200;

/** Where the pilot is going, whom it shoots, and whether it is engaging. */
interface Aim {
  readonly point: Point;
  readonly target: PerceivedShip | null;
  readonly engaging: boolean;
}

export class AverageBot implements PilotBot {
  /**
   * @param profile - Reaction, cadence and noise (average by default).
   * @param weights - Planner priorities while engaging; null = rules only.
   */
  constructor(
    readonly profile: BotProfile = TIER_PROFILES.average,
    private readonly weights: PlanWeights | null = AVERAGE_WEIGHTS,
  ) {}

  /**
   * @param view - What the pilot perceives.
   * @param random - Seeded uniform source.
   * @returns A dial read one cycle ahead when engaging, pursuit rules otherwise.
   */
  decide(view: PilotView, random: () => number): PilotIntent {
    const aim = this.aimOf(view);
    if (!aim) return IDLE_INTENT;
    if (aim.engaging && aim.target && this.weights)
      return this.engage(view, aim.target, random);
    const { self } = view;
    const error = judgedHeadingError(
      self,
      aim.point,
      view.worldSize,
      noise(this.profile.headingNoiseDeg, random),
    );
    return {
      ...IDLE_INTENT,
      maneuver: steerForError(error, AVERAGE_STEER, self.isStressed),
      targetSpeed: closingSpeed(view, aim.point, error),
      special: this.wantsKTurn(view, aim.target, random) ? "kturn" : null,
      targetId: aim.target?.id ?? null,
    };
  }

  /**
   * Read the dial one cycle ahead against the target (misjudged by the noise).
   * @returns The planned maneuver (or special) and throttle.
   */
  private engage(
    view: PilotView,
    target: PerceivedShip,
    random: () => number,
  ): PilotIntent {
    const judged = {
      ...target,
      angle: target.angle + noise(this.profile.headingNoiseDeg, random),
    };
    const plan = planManeuver(
      {
        self: view.self,
        target: judged,
        enemies: view.enemies,
        perceptionAgeMs: this.profile.reactionMs,
        worldSize: view.worldSize,
      },
      this.weights ?? AVERAGE_WEIGHTS,
    );
    const special = isSpecial(plan.maneuver)
      ? (plan.maneuver as SpecialManeuver)
      : null;
    return {
      ...IDLE_INTENT,
      maneuver: special ? "straight" : (plan.maneuver as SteerManeuver),
      special,
      targetSpeed: plan.speed,
      targetId: target.id,
    };
  }

  /**
   * @param view - What the pilot perceives.
   * @returns Where to fly and whom to shoot, or null with nothing to do.
   */
  private aimOf(view: PilotView): Aim | null {
    const { self, order } = view;
    const focus = view.enemies.find((e) => e.id === order?.focusTargetId);
    const target = focus ?? nearestShip(self, view.enemies, view.worldSize);
    if (order?.fallBack) {
      const ally = nearestShip(self, view.allies, view.worldSize);
      if (ally) return { point: ally, target, engaging: false };
    }
    if (!target) {
      const ally = view.allies.find((a) => a.id === order?.supportAllyId);
      return ally ? { point: ally, target: null, engaging: false } : null;
    }
    const range = torusOffset(self, target, view.worldSize).distance;
    if (order?.rallyPoint && range > self.weaponRange)
      return { point: order.rallyPoint, target, engaging: false };
    if (
      order &&
      focus &&
      range > FLANK_COMMIT_RANGE_PX &&
      order.approachBearingDeg !== null
    ) {
      return {
        point: flankSlot(focus, order.approachBearingDeg),
        target,
        engaging: false,
      };
    }
    const engaging = range <= self.weaponRange * AVERAGE_ENGAGE_RANGES;
    return { point: leadPoint(target, AVERAGE_LEAD_MS), target, engaging };
  }

  /**
   * @returns Whether to K-turn onto a target that slipped behind.
   */
  private wantsKTurn(
    view: PilotView,
    target: PerceivedShip | null,
    random: () => number,
  ): boolean {
    const { self } = view;
    if (!target || self.isStressed || !self.kturnReady) return false;
    if (
      Math.abs(offNoseDeg(self, target, view.worldSize)) <
      AVERAGE_KTURN_ERROR_DEG
    )
      return false;
    if (
      torusOffset(self, target, view.worldSize).distance >
      AVERAGE_KTURN_RANGE_PX
    )
      return false;
    return random() < AVERAGE_KTURN_CHANCE;
  }
}

/**
 * @param maneuver - A planned maneuver.
 * @returns Whether it is a red special (queued with its own key).
 */
function isSpecial(maneuver: string): boolean {
  return (
    maneuver === "kturn" ||
    maneuver.startsWith("segnor") ||
    maneuver.startsWith("tallon")
  );
}

/**
 * Throttle to close distance: full while the aim point is far and ahead,
 * back to cruise once it is close again; otherwise leave it (Q/E sets the
 * turn speed, and fighting it with throttle taps turns turns red).
 * @param view - What the pilot perceives.
 * @param point - Where it is flying.
 * @param errorDeg - Heading error to the point (°).
 * @returns The throttle to work toward, or null to leave it.
 */
function closingSpeed(
  view: PilotView,
  point: Point,
  errorDeg: number,
): number | null {
  const { self } = view;
  const distance = torusOffset(self, point, view.worldSize).distance;
  const cruise = Math.ceil((self.minSpeed + self.maxSpeed) / 2);
  if (distance > self.weaponRange * AVERAGE_ENGAGE_RANGES) {
    return Math.abs(errorDeg) < AVERAGE_CHASE_BEARING_DEG
      ? self.maxSpeed
      : null;
  }
  return self.speed > cruise ? cruise : null;
}

/**
 * @param target - The focus target.
 * @param bearingDeg - Slot bearing relative to its heading (180 = astern).
 * @returns The slot point next to the target.
 */
export function flankSlot(target: PerceivedShip, bearingDeg: number): Point {
  const rad = ((target.angle + bearingDeg) * Math.PI) / 180;
  return {
    x: target.x + Math.sin(rad) * FLANK_SLOT_DISTANCE_PX,
    y: target.y - Math.cos(rad) * FLANK_SLOT_DISTANCE_PX,
  };
}
