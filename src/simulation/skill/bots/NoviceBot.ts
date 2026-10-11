/**
 * NoviceBot — a beginner: chases the nearest enemy nose-to-nose (no lead,
 * no positioning), reacts slowly, misjudges the heading a lot, yanks hard
 * turns early, never manages the throttle (flies whatever speed it spawned
 * at, never slowing to turn) and never uses specials, boost or barrel rolls.
 *
 * Pure: no Phaser.
 */

import {
  IDLE_INTENT,
  type BotProfile,
  type PilotBot,
  type PilotIntent,
  type PilotView,
} from "../SkillTypes";
import {
  judgedHeadingError,
  nearestShip,
  noise,
  steerForError,
  TIER_PROFILES,
  type SteerThresholds,
} from "./BotKit";

/** A novice's steering: holds late, escalates to hard turns early. */
export const NOVICE_STEER: SteerThresholds = { hold: 10, drift: 35, bank: 70 };

export class NoviceBot implements PilotBot {
  /** @param profile - Reaction, cadence and noise (novice by default). */
  constructor(readonly profile: BotProfile = TIER_PROFILES.novice) {}

  /**
   * @param view - What the pilot perceives.
   * @param random - Seeded uniform source.
   * @returns Chase the nearest enemy, throttle untouched.
   */
  decide(view: PilotView, random: () => number): PilotIntent {
    const { self } = view;
    const target = nearestShip(self, view.enemies, view.worldSize);
    if (!target) return IDLE_INTENT;
    const error = judgedHeadingError(
      self,
      target,
      view.worldSize,
      noise(this.profile.headingNoiseDeg, random),
    );
    return {
      ...IDLE_INTENT,
      maneuver: steerForError(error, NOVICE_STEER, self.isStressed),
      targetId: target.id,
    };
  }
}
