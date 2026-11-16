/**
 * aceConfig — every constant of the ACE hit-and-run mechanics in one place
 * (spec: docs/specs/aces.md). Aces are named pilots flown for strikes: dive
 * in, hit, leave, come back. Three mechanics read these values:
 * - strike window (arcade/systems/AceStrike): a dash opens a short window in
 *   which the ace's shot is easier to land and hits harder;
 * - disengage reward (arcade/systems/Disengage): slipping out of an enemy's
 *   fire (or its mark) and opening the range gives a brief evasion bonus;
 * - ace bot policy (arcade/ai/AceStrikePolicy): the AI flies that rhythm.
 *
 * Every bonus is deliberately small: aces alone must still lose to a
 * coordinated squad (skill gate 2 stays >= 70 %). Tune these, never the gates.
 * Pure data: no imports from the engine except the cycle length.
 */

import { CYCLE_DURATION_MS } from "../config";

// --- Who is an ace --------------------------------------------------------

/**
 * A pilot is an ace when it is a named (unique) pilot card of at least this
 * initiative (1-6) that flies with a signature ability. Generic cadets and
 * the three initiative-3 named pilots are not aces.
 */
export const ACE_MIN_INITIATIVE = 4;

// --- Strike window --------------------------------------------------------

/**
 * How long after a dash (boost, barrel roll, Snap turn / Hook / Knife) the
 * ace's shots count as a strike (ms): one maneuver cycle, which is also one
 * attack interval, so the dash covers exactly the next attack.
 */
export const STRIKE_WINDOW_MS = CYCLE_DURATION_MS;

/** Shots one strike window can boost (a weapon attacks once per cycle). */
export const STRIKE_WINDOW_SHOTS = 1;

/**
 * Hit-chance bonus of a strike shot (0-1). A strike only counts against the
 * target the ace's squad marked (ShotLevers): a strike is a squad tactic, so
 * a solo ace gets none (gate 2 keeps its margin). Weaker than the mark's own
 * +0.35 / +5.
 */
export const STRIKE_HIT_BONUS = 0.2;

/** Extra damage per hit of a strike shot (before the defender's mitigation). */
export const STRIKE_DAMAGE_BONUS = 3;

// --- Disengage reward -----------------------------------------------------

/**
 * Distance (px) an ace must open to the enemy that had it in arc, after
 * leaving that arc, for the break-away to count. Beyond RANGE_3 (300 px):
 * stepping a few pixels out of the cone is not a disengage.
 */
export const DISENGAGE_MIN_RANGE_PX = 400;

/** How long the evasion bonus lasts after a disengage (ms). */
export const DISENGAGE_EVADE_MS = 1000;

/** Hit-chance penalty of every shot against a disengaging ace (0-1). */
export const DISENGAGE_EVASION_HIT_PENALTY = 0.1;

/**
 * Share of the ace's remaining boost recharge refunded by a disengage (0-1):
 * the speed half of the reward, so the ace can dash back in sooner.
 */
export const DISENGAGE_BOOST_REFUND = 0.5;

/** Minimum time between two disengage rewards of one ace (ms). */
export const DISENGAGE_REWARD_COOLDOWN_MS = 3000;

// --- Ace bot policy -------------------------------------------------------

/**
 * Whether an ace's bot flies the hit-and-run policy (AceStrikePolicy,
 * AceTargeting). OFF by default: measured on the real engine the policy
 * costs its own side (classic auto-fill squads: an ace's side gives up
 * 4-6 win points, and the faction-identity margin of Ascendant / Confederation
 * falls below the +8 gate), while the strike window and disengage reward
 * alone keep the ace-squad gain (+2.5 on the ace report; docs/specs/aces.md).
 * The ace still dashes and rolls like its tier's bot; flip this to re-measure.
 */
export const ACE_BOT_POLICY = false;

/**
 * Time in weapon contact (ms) after which a healthy ace that is outnumbered
 * in that spot (ACE_OUTNUMBERED_THREATS) breaks off: a burst. Without
 * company it keeps fighting: every second away from the guns costs more
 * damage than it saves (measured: docs/specs/aces.md).
 */
export const ACE_BURST_MS = 1500;

/** Time in contact (ms) after which a hurt ace under fire breaks off: one attack. */
export const ACE_LOW_HEALTH_BURST_MS = 500;

/**
 * A healthy ace breaks off after its burst only when at least this many
 * enemies have it in their firing arc (it is outnumbered in that spot).
 */
export const ACE_OUTNUMBERED_THREATS = 3;

/** Health fraction (hull + shields) at or below which the ace counts as hurt. */
export const ACE_BREAK_OFF_HEALTH = 0.3;

/** How long the ace flies away once it breaks off (ms). */
export const ACE_DISENGAGE_MS = 1000;

/** The ace re-enters only when its target is at least this far (px)... */
export const ACE_REENTRY_RANGE_PX = 450;

/** ...or when the disengage has lasted this long (ms), whichever is first. */
export const ACE_DISENGAGE_MAX_MS = 1500;

/** Approach bearing off the target's nose (°): rear-flank, never head-on. */
export const ACE_APPROACH_BEARING_DEG = 150;

/** A target with no other enemy within this radius is isolated (px). */
export const ACE_ISOLATION_RADIUS_PX = 450;

/** Distance discount for an isolated target when the ace picks one (px). */
export const ACE_ISOLATED_TARGET_BONUS_PX = 300;

/** Distance discount for the target the squad marked (px). */
export const ACE_MARKED_TARGET_BONUS_PX = 500;

/** The ace dives with a boost only below this stress level (0-1). */
export const ACE_BOOST_MAX_STRESS = 0.4;

/** The ace boosts in when its target is within this bearing off its nose (°). */
export const ACE_DIVE_BEARING_DEG = 25;

/** The ace boosts in from at most this far outside its weapon range (px). */
export const ACE_DIVE_EXTRA_RANGE_PX = 300;
