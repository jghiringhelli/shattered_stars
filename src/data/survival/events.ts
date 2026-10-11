/**
 * Survival roguelite — the event registry: every text event and the seeded
 * pick for an event node. Types live in eventTypes.ts.
 */

import type { RandomGenerator } from "../../utils/random";
import type { SurvivalEvent } from "./eventTypes";
import { FACTION_EVENTS } from "./eventsFaction";
import { NEUTRAL_EVENTS } from "./eventsNeutral";

/** Every event in the game. */
export const ALL_EVENTS: readonly SurvivalEvent[] = [
  ...NEUTRAL_EVENTS,
  ...FACTION_EVENTS,
];

/**
 * @param id - An event id.
 * @returns The event, or undefined.
 */
export function getEvent(id: string): SurvivalEvent | undefined {
  return ALL_EVENTS.find((e) => e.id === id);
}

/**
 * Picks an event for a node, preferring ones not seen this run.
 *
 * @param rng - Seeded RNG of the node.
 * @param seen - Event ids already visited this run.
 * @returns The event.
 */
export function pickEvent(
  rng: RandomGenerator,
  seen: readonly string[],
): SurvivalEvent {
  const fresh = ALL_EVENTS.filter((e) => !seen.includes(e.id));
  const pool = fresh.length > 0 ? fresh : ALL_EVENTS;
  return rng.pick(pool) ?? ALL_EVENTS[0]!;
}
