/**
 * BotPilot — specification tests for the scene-facing AI pilot: it flies
 * only through the player's controls, is deterministic for a seed, honours
 * the tier's reaction, keeps capitals from flipping or dashing, and forgets
 * everything on reset.
 */

import { describe, expect, it } from "vitest";
import { BotPilot } from "../../../../src/arcade/ai/BotPilot";
/** A reaction scale twice as fast as the tier's. */
const FAST_REACTION_SCALE = 0.5;
import type { BotContact } from "../../../../src/arcade/ai/BotView";
import {
  tickCycleFlight,
  type CycleFlightState,
} from "../../../../src/arcade/systems/CycleFlight";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../../src/config";
import type { BotTier } from "../../../../src/arcade/ai/BotTypes";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { contact, flightOf } from "./aiFixtures";

const TICK_MS = 1000 / 60;

/** Fly one AI ship against a static enemy; record what it committed and did. */
function fly(
  tier: BotTier,
  definitionId: string,
  enemyPose: { x: number; y: number; angle: number },
  cycles: number,
  pilot = new BotPilot(tier, { seed: 7 }),
  safePoint: { x: number; y: number } | null = null,
) {
  const self = contact("ai", "ai", definitionId, {
    x: 3000,
    y: 3000,
    angle: 0,
  });
  const enemy = contact("player", "player", "terran_gladius", enemyPose);
  const dial = getShipDial(definitionId);
  let flight: CycleFlightState = flightOf(self);
  const committed: string[] = [];
  const events: string[] = [];
  for (let t = 0; t < cycles * CYCLE_DURATION_MS; t += TICK_MS) {
    const result = pilot.fly({
      self,
      flight,
      dial,
      contacts: [enemy],
      nowMs: t,
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
      safePoint,
    });
    events.push(...result.events);
    const tick = tickCycleFlight(
      { motion: result.motion, stress: result.stress },
      {
        deltaMs: TICK_MS,
        worldSize: BATTLEFIELD_SIZE,
        dial,
        cycleMs: CYCLE_DURATION_MS,
      },
    );
    flight = tick.state;
    if (tick.completed) {
      const started = flight.motion.control.currentManeuver ?? "straight";
      committed.push(started);
      pilot.onCycleCommitted(started);
    }
  }
  return { committed, events, flight, pilot };
}

describe("BotPilot", () => {
  it("turns toward an enemy off its wing through the pilot controls", () => {
    const { committed } = fly(
      "average",
      "terran_gladius",
      { x: 3600, y: 3000, angle: 0 },
      6,
    );
    expect(committed.some((m) => m.endsWith("right"))).toBe(true);
  });

  it("breaks off toward the safe point while a hazard threatens, even with an enemy dead ahead", () => {
    const enemyAhead = { x: 3000, y: 2500, angle: 180 };
    const escaping = fly(
      "expert",
      "terran_gladius",
      enemyAhead,
      4,
      new BotPilot("expert", { seed: 7 }),
      { x: 3600, y: 3000 },
    );
    const angle = ((escaping.flight.motion.angle % 360) + 360) % 360;
    expect(angle).toBeGreaterThan(45);
    expect(angle).toBeLessThan(135);
  });

  it("is deterministic for a seed", () => {
    const a = fly(
      "expert",
      "terran_gladius",
      { x: 3300, y: 2600, angle: 90 },
      10,
    );
    const b = fly(
      "expert",
      "terran_gladius",
      { x: 3300, y: 2600, angle: 90 },
      10,
    );
    expect(b.committed).toEqual(a.committed);
    expect(b.flight.motion.x).toBe(a.flight.motion.x);
  });

  it("targets the enemy it chases", () => {
    const { pilot } = fly(
      "novice",
      "terran_gladius",
      { x: 3000, y: 2500, angle: 180 },
      2,
    );
    expect(pilot.targetId).toBe("player");
  });

  it("takes the tier's reaction, scaled by the reaction scale", () => {
    expect(new BotPilot("expert").profile.reactionMs).toBe(120);
    expect(
      new BotPilot("expert", { reactionScale: FAST_REACTION_SCALE }).profile
        .reactionMs,
    ).toBe(60);
  });

  it("never flips or dashes a capital hull, even as an expert with the enemy behind", () => {
    const { committed, events } = fly(
      "expert",
      "terran_imperator",
      { x: 3000, y: 3300, angle: 0 },
      30,
    );
    expect(committed.filter((m) => /kturn|segnor|tallon/.test(m))).toEqual([]);
    expect(
      events.filter(
        (e) => e === "boost" || e === "barrel_roll" || e === "kturn",
      ),
    ).toEqual([]);
  });

  it("forgets its intent and perception on reset", () => {
    const { pilot } = fly(
      "average",
      "terran_gladius",
      { x: 3000, y: 2500, angle: 180 },
      2,
    );
    pilot.reset();
    expect(pilot.targetId).toBeNull();
  });

  it("perceives others with its reaction delay (a contact appearing late is not seen at once)", () => {
    const pilot = new BotPilot("novice", { seed: 3 });
    const self = contact("ai", "ai", "terran_gladius", {
      x: 3000,
      y: 3000,
      angle: 0,
    });
    const enemy: BotContact = contact("p", "player", "terran_gladius", {
      x: 3000,
      y: 2600,
      angle: 0,
    });
    const flight = flightOf(self);
    const dial = getShipDial("terran_gladius");
    for (let t = 0; t < 400; t += TICK_MS)
      pilot.fly({
        self,
        flight,
        dial,
        contacts: [],
        nowMs: t,
        deltaMs: TICK_MS,
        worldSize: BATTLEFIELD_SIZE,
      });
    for (let t = 400; t < 600; t += TICK_MS)
      pilot.fly({
        self,
        flight,
        dial,
        contacts: [enemy],
        nowMs: t,
        deltaMs: TICK_MS,
        worldSize: BATTLEFIELD_SIZE,
      });
    expect(pilot.targetId).toBeNull();
  });
});
