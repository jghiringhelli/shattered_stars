/**
 * Steering mode — how the player's turn key becomes a heading change.
 *
 * - `template`: the classic engine. A steer queues a drift / bank / hard turn
 *   template that flies in a 500 ms cycle (a human steer cuts the running
 *   cycle); Q / E are the hard-turn keys.
 * - `analog`: ONE turn key. The ship turns while the key is held at the
 *   rate the dial allows at its flown speed (hard-turn speeds: the 90° template
 *   per cycle; bank-only speeds: the 45° template; cruise speeds: no turn, so
 *   steering slows the ship to the fastest speed that has a turn). Holding
 *   half the time turns half the angle. A full-cycle hold flies exactly the
 *   tabletop template.
 *
 * Pure data: the engine, the setting and the online lock live elsewhere.
 */

export const STEERING_MODES = ["template", "analog"] as const;
export type SteeringMode = (typeof STEERING_MODES)[number];

/** The mode online battles always use (lockstep needs identical rules). */
export const ONLINE_STEERING_MODE: SteeringMode = "template";

/** What a fresh profile uses until the analog engine is adopted. */
export const DEFAULT_STEERING_MODE: SteeringMode = "template";
