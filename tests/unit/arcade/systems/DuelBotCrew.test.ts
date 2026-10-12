/**
 * DuelBotCrew — specification tests for the duel scenes' AI crew: a bot per
 * AI ship (none for humans), a squad layer only for sides of 2+ ships, the
 * player's mark stored and shown but worth the mark bonus only to a squad,
 * AI squads marking their own focus, the player's wingmen focusing the
 * player's mark, and marks lapsing when their target dies.
 */

import { describe, it, expect } from "vitest";
import { BATTLEFIELD_SIZE, LOGIC_DELTA } from "../../../../src/config";
/** A reaction scale twice as fast as the tier's. */
const FAST_REACTION_SCALE = 0.5;
import {
  DuelBotCrew,
  contactOf,
  type DuelCrewMember,
} from "../../../../src/arcade/systems/DuelBotCrew";
import { SQUAD_MARK_DURATION_MS } from "../../../../src/arcade/systems/SquadMark";
import {
  spawnDuelSide,
  type DuelSimShip,
} from "../../../../src/simulation/duelSimShips";

const AVERAGE = { tier: "average", reactionScale: 1 } as const;
const EXPERT_FAST = {
  tier: "expert",
  reactionScale: FAST_REACTION_SCALE,
} as const;
/** Long enough for perception, a squad plan and a few bot decisions. */
const SETTLE_MS = 2000;

function member(
  shipId: string,
  side: string,
  skill: DuelCrewMember["skill"] = AVERAGE,
): DuelCrewMember {
  return { shipId, side, skill };
}

function crewOf(
  roster: DuelCrewMember[],
  playerSide: string | null = "side1",
): DuelBotCrew {
  return new DuelBotCrew({
    roster,
    playerSide,
    random: () => 0.5,
    worldSize: BATTLEFIELD_SIZE,
  });
}

/** Run the crew's squad layer and bots for a while (ships hold their poses). */
function settle(crew: DuelBotCrew, ships: DuelSimShip[]): void {
  for (let now = LOGIC_DELTA; now <= SETTLE_MS; now += LOGIC_DELTA) {
    const contacts = crew.contactsOf(ships);
    crew.command(contacts, now);
    for (const ship of ships) crew.fly(ship, contacts, now, LOGIC_DELTA);
  }
}

describe("DuelBotCrew pilots", () => {
  it("gives every AI ship a bot of its tier and reaction", () => {
    const crew = crewOf([
      member("p", "side1", null),
      member("ai", "side2", EXPERT_FAST),
    ]);
    const bot = crew.pilots.get("ai")!;
    expect(bot.tier).toBe("expert");
    expect(bot.profile.reactionMs).toBeLessThan(
      crewOf([
        member("x", "side2", { tier: "expert", reactionScale: 1 }),
      ]).pilots.get("x")!.profile.reactionMs,
    );
  });

  it("gives no bot to a human ship", () => {
    const crew = crewOf([member("p", "side1", null), member("ai", "side2")]);
    expect(crew.pilots.has("p")).toBe(false);
  });

  it("flies only ships that have a bot", () => {
    const [human] = spawnDuelSide(1, ["confed_falcon"]);
    const [foe] = spawnDuelSide(2, ["terran_raptor"]);
    const crew = crewOf([
      member(human!.id, "side1", null),
      member(foe!.id, "side2"),
    ]);
    const contacts = crew.contactsOf([human!, foe!]);
    expect(crew.fly(human!, contacts, 16, 16)).toBeNull();
    expect(crew.fly(foe!, contacts, 16, 16)?.motion).toBeDefined();
  });

  it("has no preferred target for a ship without a bot", () => {
    expect(crewOf([member("p", "side1", null)]).targetOf("p")).toBeNull();
  });
});

describe("DuelBotCrew squads", () => {
  it("flies a side as a squad only with two or more ships", () => {
    const crew = crewOf([
      member("p", "side1", null),
      member("a", "side2"),
      member("b", "side2"),
    ]);
    expect(crew.isSquad("side1")).toBe(false);
    expect(crew.isSquad("side2")).toBe(true);
  });

  it("lets an AI squad mark its own focus", () => {
    const ships = [
      ...spawnDuelSide(1, ["confed_falcon"]),
      ...spawnDuelSide(2, ["terran_raptor", "terran_raptor"]),
    ];
    const crew = crewOf(ships.map((s) => member(s.id, `side${s.side}`)));
    settle(crew, ships);
    expect(crew.markedTargetOf("side2", SETTLE_MS)).toBe("side1_0");
  });

  it("never marks for the player's side on its own", () => {
    const ships = [
      ...spawnDuelSide(1, ["confed_falcon", "confed_falcon"]),
      ...spawnDuelSide(2, ["terran_raptor", "terran_raptor"]),
    ];
    const crew = crewOf(
      ships.map((s) =>
        member(s.id, `side${s.side}`, s.id === "side1_0" ? null : AVERAGE),
      ),
    );
    settle(crew, ships);
    expect(crew.markedTargetOf("side1", SETTLE_MS)).toBeNull();
  });

  it("has the player's wingman go after the player's mark", () => {
    const ships = [
      ...spawnDuelSide(1, ["confed_falcon", "confed_falcon"]),
      ...spawnDuelSide(2, ["terran_raptor", "terran_raptor"]),
    ];
    const crew = crewOf(
      ships.map((s) =>
        member(s.id, `side${s.side}`, s.id === "side1_0" ? null : AVERAGE),
      ),
    );
    crew.markTarget("side1", "side2_1", 0);
    settle(crew, ships);
    expect(crew.targetOf("side1_1")).toBe("side2_1");
  });
});

describe("DuelBotCrew marks", () => {
  const roster = [
    member("p", "side1", null),
    member("w", "side1"),
    member("a", "side2"),
  ];

  it("stores the player's mark until it lapses", () => {
    const crew = crewOf(roster);
    crew.markTarget("side1", "a", 1000);
    expect(crew.markedTargetOf("side1", 1000)).toBe("a");
    expect(
      crew.markedTargetOf("side1", 1000 + SQUAD_MARK_DURATION_MS),
    ).toBeNull();
  });

  it("grants the mark bonus to a squad's shot at its marked target", () => {
    const crew = crewOf(roster);
    crew.markTarget("side1", "a", 0);
    expect(crew.isMarkedShot("p", "a", 10)).toBe(true);
    expect(crew.isMarkedShot("w", "a", 10)).toBe(true);
  });

  it("grants no mark bonus to a pilot flying on their own", () => {
    const crew = crewOf([member("p", "side1", null), member("a", "side2")]);
    crew.markTarget("side1", "a", 0);
    expect(crew.markedTargetOf("side1", 10)).toBe("a");
    expect(crew.isMarkedShot("p", "a", 10)).toBe(false);
  });

  it("grants no mark bonus against an unmarked target", () => {
    const crew = crewOf([...roster, member("b", "side2")]);
    crew.markTarget("side1", "a", 0);
    expect(crew.isMarkedShot("p", "b", 10)).toBe(false);
  });

  it("drops the mark when its target is destroyed", () => {
    const crew = crewOf(roster);
    crew.markTarget("side1", "a", 0);
    crew.forget("a");
    expect(crew.markedTargetOf("side1", 10)).toBeNull();
  });
});

describe("contactOf", () => {
  it("describes a ship to the AI with its side, arc, range and throttle", () => {
    const [ship] = spawnDuelSide(2, ["terran_raptor"]);
    const contact = contactOf(ship!, "side2");
    expect(contact).toMatchObject({
      id: "side2_0",
      side: "side2",
      alive: true,
      firingArcDeg: ship!.combatStats.firingArc,
      weaponRange: ship!.combatStats.weaponRange,
      speed: ship!.flight.motion.control.speed,
    });
  });

  it("reports a destroyed ship as not alive", () => {
    const [ship] = spawnDuelSide(2, ["terran_raptor"]);
    expect(contactOf({ ...ship!, hull: 0 }, "side2").alive).toBe(false);
  });

  it("only lists rostered ships", () => {
    const ships = spawnDuelSide(1, ["confed_falcon", "confed_falcon"]);
    const crew = crewOf([member("side1_0", "side1")]);
    expect(crew.contactsOf(ships).map((c) => c.id)).toEqual(["side1_0"]);
  });
});
