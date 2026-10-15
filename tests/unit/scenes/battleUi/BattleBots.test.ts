/**
 * BattleBots — specification tests for a battle's AI crew: pilots fly
 * only ships that have one, AI-led squads mark their focus, a squad that
 * is part of a side (an escort wave) never plans against the rest of its
 * side, a screen hides contacts from a squad, the player's mark drives a
 * player-led squad, and a ship leaving the battle takes its pilot and any
 * mark on it along.
 */

import { describe, expect, it } from "vitest";
import type { BotContact } from "../../../../src/arcade/ai";
import { BattleBots } from "../../../../src/scenes/battleUi/BattleBots";
import { contact, flightOf } from "../../arcade/ai/aiFixtures";
import { getShipDial } from "../../../../src/data/ShipDefinitions";

const SHIP = "terran_gladius";
const WORLD = 6000;
const STEP_MS = 50;

function bots(): BattleBots {
  let seed = 0.37;
  return new BattleBots({
    worldSize: WORLD,
    random: () => (seed = (seed * 9301 + 0.49297) % 1),
  });
}

/** Two escort waves of one ship each against two player ships. */
function raid(): BotContact[] {
  return [
    contact("p1", "player", SHIP, { x: 3000, y: 3000, angle: 0 }),
    contact("p2", "player", SHIP, { x: 3100, y: 3000, angle: 0 }),
    contact("e1", "boss", SHIP, { x: 3000, y: 2400, angle: 180 }),
    contact("e2", "boss", SHIP, { x: 3100, y: 2400, angle: 180 }, { hull: 1 }),
  ];
}

/** Run the squads for a while (past their reaction delay). */
function command(
  crew: BattleBots,
  contacts: BotContact[],
  untilMs = 1000,
): void {
  for (let t = 0; t <= untilMs; t += STEP_MS) crew.command(t, contacts);
}

describe("BattleBots — pilots", () => {
  it("gives a ship a pilot of the requested tier", () => {
    const crew = bots();
    crew.addPilot({ shipId: "e1", tier: "expert", reactionScale: 0.5 });
    expect(crew.tierOf("e1")).toBe("expert");
    expect(crew.tierOf("p1")).toBeNull();
  });

  it("flies only ships that have a pilot", () => {
    const crew = bots();
    crew.addPilot({ shipId: "e1", tier: "average" });
    const contacts = raid();
    const input = (ship: BotContact) => ({
      flight: flightOf(ship),
      dial: getShipDial(SHIP),
      nowMs: 0,
      deltaMs: STEP_MS,
    });
    expect(crew.fly("p1", contacts, input(contacts[0]!))).toBeNull();
    const result = crew.fly("e1", contacts, input(contacts[2]!));
    expect(result?.motion).toBeDefined();
  });
});

describe("BattleBots — squads", () => {
  it("an AI-led squad marks its focus", () => {
    const crew = bots();
    crew.addSquad({ key: "red", side: "player", aiLeader: true });
    crew.enlist("p1", "red");
    command(crew, raid());
    expect(["e1", "e2"]).toContain(crew.markedTarget("red", 1000));
    expect(crew.orderFor("p1")?.focusTargetId).toBe(
      crew.markedTarget("red", 1000),
    );
  });

  it("an escort wave plans against the enemy, never the other wave", () => {
    const crew = bots();
    crew.addSquad({ key: "wave_1", side: "boss", aiLeader: true });
    crew.addSquad({ key: "wave_2", side: "boss", aiLeader: true });
    crew.enlist("e1", "wave_1");
    crew.enlist("e2", "wave_2");
    command(crew, raid());
    expect(["p1", "p2"]).toContain(crew.orderFor("e1")?.focusTargetId);
    expect(["p1", "p2"]).toContain(crew.orderFor("e2")?.focusTargetId);
  });

  it("a screen hides contacts from the squad", () => {
    const crew = bots();
    crew.addSquad({
      key: "player",
      side: "player",
      aiLeader: false,
      screen: (contacts) => contacts.filter((c) => c.id !== "e2"),
    });
    crew.enlist("p2", "player");
    command(crew, raid());
    expect(crew.orderFor("p2")?.focusTargetId).toBe("e1");
  });

  it("a player-led squad focuses the player's mark and never marks itself", () => {
    const crew = bots();
    crew.addSquad({ key: "player", side: "player", aiLeader: false });
    crew.enlist("p2", "player");
    command(crew, raid(), 300);
    expect(crew.markedTarget("player", 300)).toBeNull();
    crew.mark("player", "e1", 300);
    for (let t = 300; t <= 1500; t += STEP_MS) crew.command(t, raid());
    expect(crew.orderFor("p2")?.focusTargetId).toBe("e1");
    expect(crew.markedTargetFor("p2", "unused", 1500)).toBe("e1");
  });

  it("a ship in no squad reads its side's mark", () => {
    const crew = bots();
    crew.mark("player", "e2", 0);
    expect(crew.markedTargetFor("p1", "player", 10)).toBe("e2");
    expect(crew.squadKeyOf("p1")).toBeNull();
  });

  describe("wingmen mark assist (Settings > Gameplay)", () => {
    function playerSquad(markAssist: boolean): BattleBots {
      const crew = new BattleBots({
        worldSize: WORLD,
        random: () => 0.5,
        markAssist,
      });
      crew.addSquad({
        key: "player",
        side: "player",
        aiLeader: false,
        assistMark: true,
      });
      crew.enlist("p1", "player");
      crew.enlist("p2", "player");
      command(crew, raid(), 1500);
      return crew;
    }

    it("lets a player-led squad mark its own focus when the setting is on", () => {
      expect(playerSquad(true).markedTarget("player", 1500)).not.toBeNull();
    });

    it("keeps a player-led squad from marking when the setting is off", () => {
      expect(playerSquad(false).markedTarget("player", 1500)).toBeNull();
    });
  });
});

describe("BattleBots — leaving the battle", () => {
  it("drops the ship's pilot, membership and any mark on it", () => {
    const crew = bots();
    crew.addSquad({ key: "player", side: "player", aiLeader: false });
    crew.addPilot({ shipId: "e1", tier: "novice" });
    crew.enlist("e1", "player");
    crew.mark("player", "e1", 0);
    crew.remove("e1");
    expect(crew.tierOf("e1")).toBeNull();
    expect(crew.squadKeyOf("e1")).toBeNull();
    expect(crew.markedTarget("player", 10)).toBeNull();
  });

  it("reset forgets pilots, squads and marks", () => {
    const crew = bots();
    crew.addSquad({ key: "player", side: "player", aiLeader: false });
    crew.addPilot({ shipId: "p1", tier: "average" });
    crew.enlist("p1", "player");
    crew.mark("player", "e1", 0);
    crew.reset();
    expect(crew.tierOf("p1")).toBeNull();
    expect(crew.orderFor("p1")).toBeNull();
    expect(crew.marks.size).toBe(0);
  });
});
