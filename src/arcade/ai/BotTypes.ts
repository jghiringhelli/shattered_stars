/**
 * BotTypes — data contracts of the AI pilots (the in-game AI and the skill
 * gates fly the same bots): what a bot perceives (its own ship exactly,
 * every other ship through a delayed, noisy view), what it decides (the
 * same intents a human expresses with the keyboard) and the squad orders a
 * coordination layer may hand it.
 *
 * Pure data, no behaviour, no Phaser.
 */

import type { DialSpeedTable } from "../../core/speedCap";
import type { ManeuverDefinition } from "../../core/types";

/** How well a bot flies. */
export type SkillTier = "novice" | "average" | "expert";

/** Same as {@link SkillTier} — the name scenes use. */
export type BotTier = SkillTier;

/**
 * A side of a battle: any key the scene uses (faction, owner, "A"/"B").
 * Ships of the same side are allies.
 */
export type SideKey = string;

/** A pose on the battlefield (angle in degrees, 0 = up, clockwise). */
export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** What any pilot can see of a ship (its own or another). */
export interface ShipSnapshot extends Pose {
  readonly id: string;
  readonly side: SideKey;
  readonly definitionId: string;
  readonly alive: boolean;
  /** Current throttle setting (template speed). */
  readonly speed: number;
  /** (hull + shields) / (maxHull + maxShields), 0–1. */
  readonly healthFraction: number;
  readonly isStressed: boolean;
  /** Full width of the primary firing arc (°). */
  readonly firingArcDeg: number;
  /** Primary weapon range (px). */
  readonly weaponRange: number;
}

/** Another ship as perceived: a delayed snapshot plus its observed motion. */
export interface PerceivedShip extends ShipSnapshot {
  /** Observed velocity (px per ms). */
  readonly vx: number;
  readonly vy: number;
  /** Observed turn rate (° per ms, positive = clockwise). */
  readonly turnRateDegPerMs: number;
}

/** Everything a pilot knows exactly about its own ship. */
export interface OwnShipView extends ShipSnapshot {
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly baseSize: number;
  readonly stressLevel: number;
  readonly dial: readonly ManeuverDefinition[];
  /**
   * Dial speeds per maneuver (the speed cap, src/core/speedCap): the planner
   * flies each option at min(throttle, cap). Omitted = no cap.
   */
  readonly dialSpeeds?: DialSpeedTable | undefined;
  /** Time left before the queued maneuver commits (ms). */
  readonly msToCommit: number;
  /** Where the maneuver in flight ends (the pose the next one starts from). */
  readonly endPose: Pose;
  /** The Snap turn is recharged, on the dial and allowed under stress. */
  readonly kturnReady: boolean;
  /** Specials it may queue now: recharged, on its dial, allowed under stress. */
  readonly availableSpecials: readonly SpecialManeuver[];
  /** Boost recharged, on the action bar, pilot not stressed. */
  readonly boostReady: boolean;
  /** Barrel roll recharged, on the action bar, pilot not stressed. */
  readonly barrelRollReady: boolean;
}

/** Orders a squad coordination layer gives one of its pilots. */
export interface SquadOrder {
  /** The enemy the whole squad attacks (focus fire), if any. */
  readonly focusTargetId: string | null;
  /**
   * Flank slot: bearing (° relative to the focus target's heading, 180 =
   * dead astern) this pilot approaches the target from; null = pursue
   * directly.
   */
  readonly approachBearingDeg: number | null;
  /** Ally to stay near when not engaged (support / wingman), if any. */
  readonly supportAllyId: string | null;
  /**
   * Form-up point (squadron cohesion): fly here instead of engaging until
   * the squad arrives together; null = engage.
   */
  readonly rallyPoint: { readonly x: number; readonly y: number } | null;
  /** Damaged: disengage toward the squad instead of pressing the attack. */
  readonly fallBack: boolean;
}

/** One decision's worth of world, as the pilot sees it. */
export interface PilotView {
  readonly nowMs: number;
  readonly worldSize: number;
  readonly self: OwnShipView;
  readonly allies: readonly PerceivedShip[];
  readonly enemies: readonly PerceivedShip[];
  readonly order: SquadOrder | null;
}

/** Ordinary maneuvers a pilot steers with (arrows, hold, Q/E). */
export type SteerManeuver =
  | "straight"
  | "drift_left"
  | "drift_right"
  | "bank_left"
  | "bank_right"
  | "turn_left"
  | "turn_right";

/** Red specials a pilot queues with a dedicated key or gesture. */
export type SpecialManeuver =
  "kturn" | "segnor_left" | "segnor_right" | "tallon_left" | "tallon_right";

/** What a pilot wants its hands to do until its next decision. */
export interface PilotIntent {
  /** Maneuver to have queued at the next cycle boundary. */
  readonly maneuver: SteerManeuver;
  /** One-shot special to queue (takes precedence over the maneuver). */
  readonly special: SpecialManeuver | null;
  /** Throttle setting to work toward (one notch per press); null = leave. */
  readonly targetSpeed: number | null;
  /** One-shot boost. */
  readonly boost: boolean;
  /** One-shot barrel roll. */
  readonly barrelRoll: "left" | "right" | null;
  /** Enemy the pilot is trying to shoot (preferred when several are in arc). */
  readonly targetId: string | null;
}

/** Reaction, cadence and noise of a pilot. */
export interface BotProfile {
  readonly tier: SkillTier;
  /** Perception delay: others are seen as they were this long ago (ms). */
  readonly reactionMs: number;
  /** Time between two decisions (ms). */
  readonly decisionIntervalMs: number;
  /** Max heading misjudgement per decision (±°, uniform). */
  readonly headingNoiseDeg: number;
}

/** A bot pilot: decides intents from a view, nothing else. */
export interface PilotBot {
  readonly profile: BotProfile;
  /**
   * @param view - What the pilot perceives now.
   * @param random - Seeded uniform source in [0, 1).
   * @returns The intent its hands carry out until the next decision.
   */
  decide(view: PilotView, random: () => number): PilotIntent;
}

/** A squad's shared tactical layer: hands each member its orders. */
export interface SquadBrain {
  /** Perception delay of the squad's shared picture (ms). */
  readonly reactionMs: number;
  /**
   * @param own - The squad's living ships (exact: the squad knows itself).
   * @param enemies - Living enemies as the squad perceives them.
   * @param focusOverrideId - A target the squad must focus (the player's
   *   mark) when it is among `enemies`; null/omitted = the brain's choice.
   * @returns Orders per own ship id.
   */
  plan(
    own: readonly ShipSnapshot[],
    enemies: readonly PerceivedShip[],
    focusOverrideId?: string | null,
  ): ReadonlyMap<string, SquadOrder>;
}

/** Hold course at whatever speed: the do-nothing intent. */
export const IDLE_INTENT: PilotIntent = {
  maneuver: "straight",
  special: null,
  targetSpeed: null,
  boost: false,
  barrelRoll: null,
  targetId: null,
};
