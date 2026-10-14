/**
 * ExpertBot — an ace: reacts fast, reads the dial a cycle ahead
 * (ManeuverPlanner: lead pursuit onto the target's rear arc, out of every
 * enemy's firing arc, throttle to stay behind, Snap turn/Hook/Knife when
 * overshooting, stress budget so it can break off), and uses its reflexes:
 * barrel roll to slip out of an arc, boost to close or to escape.
 *
 * Flies on its own unless handed squad orders (then it attacks the focus).
 * Pure: no Phaser.
 */

import { barrelRollDistance } from "../../systems/ShipMotion";
import {
  extrapolatePose,
  inFiringArc,
  offNoseDeg,
  torusOffset,
  type Shooter,
} from "../AiGeometry";
import {
  IDLE_INTENT,
  type BotProfile,
  type PerceivedShip,
  type PilotBot,
  type PilotIntent,
  type PilotView,
  type Pose,
} from "../BotTypes";
import { noise, TIER_PROFILES } from "./BotKit";
import {
  EXPERT_WEIGHTS,
  planManeuver,
  type PlanOption,
  type PlanWeights,
} from "./ManeuverPlanner";

/** Plan this long before the boundary: room to hold a bank (ms). */
export const PLAN_LEAD_MS = 250;

/** No boost above this stress level (keeps Snap turns available). */
export const BOOST_MAX_STRESS = 0.4;

/** Boost to close only on a target within this off-nose bearing (°). */
export const BOOST_CLOSE_BEARING_DEG = 20;

/** Boost to close only when the target is no farther than range + this (px). */
export const BOOST_CLOSE_EXTRA_PX = 300;

/** A threat at least this far off my nose is behind me: boost away (°). */
export const ESCAPE_BEARING_DEG = 120;

/** An in-arc enemy is preferred over a nearer out-of-arc one by this much (px). */
export const IN_ARC_PREFERENCE_PX = 300;

export class ExpertBot implements PilotBot {
  private plan: PlanOption | null = null;
  private plannedThisCycle = false;
  private lastMsToCommit = Infinity;

  /**
   * @param profile - Reaction, cadence and noise (expert by default).
   * @param weights - Planner priorities.
   */
  constructor(
    readonly profile: BotProfile = TIER_PROFILES.expert,
    private readonly weights: PlanWeights = EXPERT_WEIGHTS,
  ) {}

  /**
   * @param view - What the pilot perceives.
   * @param random - Seeded uniform source.
   * @returns Planned maneuver at the boundary, reflexes in between.
   */
  decide(view: PilotView, random: () => number): PilotIntent {
    const { self } = view;
    if (self.msToCommit > this.lastMsToCommit + 1)
      this.plannedThisCycle = false;
    this.lastMsToCommit = self.msToCommit;
    const target = this.chooseTarget(view);
    if (!target) return { ...IDLE_INTENT, targetSpeed: self.speed };
    let special: PilotIntent["special"] = null;
    if (!this.plannedThisCycle && self.msToCommit <= PLAN_LEAD_MS) {
      this.plan = planManeuver(
        {
          self,
          target: misjudged(target, this.profile.headingNoiseDeg, random),
          enemies: view.enemies,
          perceptionAgeMs: this.profile.reactionMs,
          worldSize: view.worldSize,
        },
        this.weights,
      );
      this.plannedThisCycle = true;
      special = isSpecial(this.plan.maneuver)
        ? (this.plan.maneuver as PilotIntent["special"])
        : null;
    }
    const steer =
      this.plannedThisCycle && this.plan && !isSpecial(this.plan.maneuver)
        ? this.plan.maneuver
        : "straight";
    const reflex = reflexes(view, target, this.profile.reactionMs);
    return {
      maneuver: steer as PilotIntent["maneuver"],
      special,
      targetSpeed: this.plan?.speed ?? self.speed,
      boost: reflex.boost,
      barrelRoll: reflex.roll,
      targetId: target.id,
    };
  }

  /**
   * The squad's focus when ordered; otherwise the nearest enemy, preferring
   * one already in arc.
   * @param view - What the pilot perceives.
   * @returns The target, or null when no enemy is left.
   */
  private chooseTarget(view: PilotView): PerceivedShip | null {
    const focus = view.enemies.find((e) => e.id === view.order?.focusTargetId);
    if (focus) return focus;
    const shooter: Shooter = {
      ...view.self,
      firingArcDeg: view.self.firingArcDeg,
      weaponRange: view.self.weaponRange,
    };
    let best: PerceivedShip | null = null;
    let bestCost = Infinity;
    for (const enemy of view.enemies) {
      const distance = torusOffset(view.self, enemy, view.worldSize).distance;
      const cost =
        distance -
        (inFiringArc(shooter, enemy, view.worldSize)
          ? IN_ARC_PREFERENCE_PX
          : 0);
      if (cost < bestCost) {
        best = enemy;
        bestCost = cost;
      }
    }
    return best;
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
 * @returns The target as the pilot misjudges it (heading off by the noise).
 */
function misjudged(
  target: PerceivedShip,
  noiseDeg: number,
  random: () => number,
): PerceivedShip {
  return { ...target, angle: target.angle + noise(noiseDeg, random) };
}

/** Instant actions the expert takes between plans. */
interface Reflex {
  readonly boost: boolean;
  readonly roll: "left" | "right" | null;
}

/**
 * Barrel roll out of an enemy's arc when it can shoot me and I cannot shoot
 * back; boost to close on a target dead ahead that is not facing me, or to
 * escape a threat sitting behind me.
 * @param view - What the pilot perceives.
 * @param target - The pilot's target.
 * @param reactionMs - How old the perceived picture is (ms).
 * @returns The reflex actions to take now.
 */
function reflexes(
  view: PilotView,
  target: PerceivedShip,
  reactionMs: number,
): Reflex {
  const { self, worldSize } = view;
  const threats = view.enemies
    .map((enemy) => ({
      ...extrapolatePose(enemy, reactionMs),
      firingArcDeg: enemy.firingArcDeg,
      weaponRange: enemy.weaponRange,
    }))
    .filter((enemy) => inFiringArc(enemy, self, worldSize));
  const canShoot = inFiringArc(self, target, worldSize);
  if (threats.length > 0 && !canShoot) {
    const roll = self.barrelRollReady
      ? rollSideOutOfArcs(self, threats, worldSize)
      : null;
    if (roll) return { boost: false, roll };
    const behind = threats.some(
      (t) => Math.abs(offNoseDeg(self, t, worldSize)) > ESCAPE_BEARING_DEG,
    );
    return { boost: behind && canBoost(self), roll: null };
  }
  const distance = torusOffset(self, target, worldSize).distance;
  const ahead =
    Math.abs(offNoseDeg(self, target, worldSize)) < BOOST_CLOSE_BEARING_DEG;
  const facingMe =
    Math.abs(offNoseDeg(target, self, worldSize)) < target.firingArcDeg / 2;
  const closing =
    ahead &&
    !facingMe &&
    distance > self.weaponRange &&
    distance < self.weaponRange + BOOST_CLOSE_EXTRA_PX;
  return { boost: closing && canBoost(self), roll: null };
}

/**
 * @param self - Own ship.
 * @returns Boost off cooldown and stress low enough to afford it.
 */
function canBoost(self: PilotView["self"]): boolean {
  return self.boostReady && self.stressLevel < BOOST_MAX_STRESS;
}

/**
 * @returns The roll side that leaves every threat's arc, or null if neither does.
 */
function rollSideOutOfArcs(
  self: PilotView["self"],
  threats: readonly Shooter[],
  worldSize: number,
): "left" | "right" | null {
  const slide = barrelRollDistance(self.baseSize);
  let best: "left" | "right" | null = null;
  let bestMargin = -Infinity;
  for (const side of ["left", "right"] as const) {
    const rad = ((self.angle + (side === "left" ? -90 : 90)) * Math.PI) / 180;
    const pose: Pose = {
      x: self.x + Math.sin(rad) * slide,
      y: self.y - Math.cos(rad) * slide,
      angle: self.angle,
    };
    if (threats.some((t) => inFiringArc(t, pose, worldSize))) continue;
    const margin = Math.min(
      ...threats.map((t) => Math.abs(offNoseDeg(t, pose, worldSize))),
    );
    if (margin > bestMargin) {
      best = side;
      bestMargin = margin;
    }
  }
  return best;
}
