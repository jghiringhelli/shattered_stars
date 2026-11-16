/**
 * ArenaAce — specification tests of the ace mechanics in the skill arena:
 * only aces are enlisted, a flown dash opens the strike window and the next
 * shot spends it, the "before" arm (aceMechanics off) has no aces at all, and
 * battles stay deterministic.
 */

import { describe, expect, it } from "vitest";
import { createArenaLoop, stepArenaLoop } from "../../../../src/simulation/arenaLoop";
import { ENGINE_RULES } from "../../../../src/simulation/skill/ArenaRules";
import { runBattle, type BattleSpec } from "../../../../src/simulation/skill/SkillArena";
import { strikeReady } from "../../../../src/arcade/systems/AceStrike";
import { noteArenaFlight } from "../../../../src/simulation/skill/ArenaAce";
import { isAceLoadout } from "../../../../src/data/aceStatus";
import { SHIP_LOADOUTS } from "../../../../src/data/ShipLoadouts";

/** A hull with an ace build and a non-ace build (first of each). */
function pickBuilds(): { hull: string; ace: string; plain: string } {
  for (const [hull, builds] of Object.entries(SHIP_LOADOUTS)) {
    const ace = builds.find((build) => isAceLoadout(build.id));
    const plain = builds.find((build) => !isAceLoadout(build.id));
    if (ace && plain) return { hull, ace: ace.id, plain: plain.id };
  }
  throw new Error("no hull with both an ace and a non-ace quick build");
}

const { hull, ace, plain } = pickBuilds();

const duel = (seed: number, aceMechanics = true): BattleSpec => ({
  A: {
    ships: [{ definitionId: hull, tier: "average", loadoutId: ace }],
    squad: null,
  },
  B: {
    ships: [{ definitionId: hull, tier: "average", loadoutId: plain }],
    squad: null,
  },
  seed,
  rules: { ...ENGINE_RULES, aceMechanics },
});

describe("arena ace mechanics", () => {
  it("flags only the ace's ship", () => {
    const loop = createArenaLoop(duel(1));
    expect(loop.ships.map((ship) => ship.isAce)).toEqual([true, false]);
  });

  it("flags nobody when the mechanics are off", () => {
    const loop = createArenaLoop(duel(1, false));
    expect(loop.ships.every((ship) => !ship.isAce)).toBe(true);
  });

  it("enlists only aces in the book once the battle runs", () => {
    const loop = createArenaLoop(duel(2));
    stepArenaLoop(loop);
    expect([...loop.combat.aceStrike!.keys()]).toEqual(["A0"]);
  });

  it("opens the strike window on a dash and spends it on the next shot", () => {
    const loop = createArenaLoop(duel(3));
    stepArenaLoop(loop);
    const aceShip = loop.ships.find((ship) => ship.id === "A0")!;
    noteArenaFlight(loop.combat, aceShip, ["boost"], loop.nowMs);
    const book = loop.combat.aceStrike!;
    const opened = strikeReady(book, "A0", loop.nowMs);
    let spent = false;
    for (let tick = 0; tick < 60 * 40 && !spent; tick += 1) {
      stepArenaLoop(loop);
      if (!strikeReady(book, "A0", loop.nowMs)) spent = true;
      if (loop.ships.some((s) => !s.alive)) break;
    }
    expect(opened).toBe(true);
    expect(spent).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const first = runBattle(duel(5));
    const second = runBattle(duel(5));
    expect(second).toEqual(first);
  });

  it("changes nothing for a battle without aces", () => {
    const noAces = (rules: BattleSpec["rules"]): BattleSpec => ({
      ...duel(7),
      A: { ...duel(7).A, ships: [{ definitionId: hull, tier: "average", loadoutId: plain }] },
      ...(rules ? { rules } : {}),
    });
    expect(runBattle(noAces({ ...ENGINE_RULES, aceMechanics: false }))).toEqual(
      runBattle(noAces(undefined)),
    );
  });
});
