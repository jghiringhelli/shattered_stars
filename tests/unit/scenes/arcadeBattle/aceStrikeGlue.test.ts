/**
 * AceStrikeGlue — specification tests of the ace mechanics as a Skirmish
 * battle runs them: only ships flown by an ace are enlisted, a flown dash
 * opens the strike window and the next shot spends it, an ace that gets
 * clear of an enemy's guns gets half its boost recharge back, and the book
 * survives an online snapshot.
 */

import { describe, expect, it } from "vitest";
import { NO_SQUAD_MARKS } from "../../../../src/arcade/systems/SquadMark";
import { DISENGAGE_BOOST_REFUND } from "../../../../src/data/aceConfig";
import { isAceLoadout } from "../../../../src/data/aceStatus";
import { SHIP_LOADOUTS } from "../../../../src/data/ShipLoadouts";
import { captureGraph, restoreGraph } from "../../../../src/net/lockstep/StateGraph";
import { AceStrikeGlue } from "../../../../src/scenes/arcadeBattle/aceStrikeGlue";
import {
  spawnArcadeShip,
  type ArcadeShip,
} from "../../../../src/scenes/arcadeBattle/arcadeShipFactory";

const NOW = 5000;

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

const spawn = (
  id: string,
  team: number,
  loadoutId: string,
  pose: { x: number; y: number; angle: number },
): ArcadeShip =>
  spawnArcadeShip({
    id,
    definitionId: hull,
    loadoutId,
    faction: "terran_hegemony",
    team,
    squad: 0,
    pilot: "ai",
    ...pose,
  });

describe("spawned ships", () => {
  it("are aces exactly when an ace flies the build", () => {
    const pose = { x: 3000, y: 3000, angle: 0 };
    expect(spawn("a", 0, ace, pose).isAce).toBe(true);
    expect(spawn("b", 1, plain, pose).isAce).toBe(false);
  });
});

describe("AceStrikeGlue strike window", () => {
  it("opens on an ace's dash and is spent by its next shot", () => {
    const glue = new AceStrikeGlue();
    const acePilot = spawn("a", 0, ace, { x: 3000, y: 3000, angle: 0 });
    const foe = spawn("b", 1, plain, { x: 3000, y: 2800, angle: 180 });
    glue.noteFlight(acePilot, ["boost"], NOW);
    expect(glue.takeShotFlags(acePilot, foe, NOW + 100).attackerStrike).toBe(true);
    expect(glue.takeShotFlags(acePilot, foe, NOW + 200).attackerStrike).toBe(false);
  });

  it("never opens for a ship that is not an ace", () => {
    const glue = new AceStrikeGlue();
    const rookie = spawn("b", 1, plain, { x: 3000, y: 2800, angle: 180 });
    const other = spawn("a", 0, ace, { x: 3000, y: 3000, angle: 0 });
    glue.noteFlight(rookie, ["boost"], NOW);
    expect(glue.takeShotFlags(rookie, other, NOW + 100).attackerStrike).toBe(false);
    expect(glue.book.size).toBe(0);
  });

  it("forgets a destroyed ace", () => {
    const glue = new AceStrikeGlue();
    const acePilot = spawn("a", 0, ace, { x: 3000, y: 3000, angle: 0 });
    glue.noteFlight(acePilot, ["boost"], NOW);
    glue.forget("a");
    expect(glue.book.has("a")).toBe(false);
  });
});

describe("AceStrikeGlue disengage", () => {
  it("refunds part of the boost recharge when the ace gets clear", () => {
    const glue = new AceStrikeGlue();
    const acePilot = spawn("a", 0, ace, { x: 3000, y: 3000, angle: 0 });
    const gunner = spawn("b", 1, plain, { x: 3000, y: 2900, angle: 180 });
    const ships = new Map([
      ["a", acePilot],
      ["b", gunner],
    ]);
    glue.noteFlight(acePilot, [], NOW);
    glue.updateDisengage(ships, NO_SQUAD_MARKS, NOW);
    acePilot.control = { ...acePilot.control, boostCooldown: 4000 };
    acePilot.y = 3600;
    glue.updateDisengage(ships, NO_SQUAD_MARKS, NOW + 100);
    expect(acePilot.control.boostCooldown).toBeCloseTo(
      4000 * (1 - DISENGAGE_BOOST_REFUND),
    );
    expect(glue.takeShotFlags(gunner, acePilot, NOW + 200).targetEvading).toBe(true);
  });

  it("does nothing in a battle without aces", () => {
    const glue = new AceStrikeGlue();
    const a = spawn("a", 0, plain, { x: 3000, y: 3000, angle: 0 });
    const b = spawn("b", 1, plain, { x: 3000, y: 2900, angle: 180 });
    glue.updateDisengage(new Map([["a", a], ["b", b]]), NO_SQUAD_MARKS, NOW);
    expect(glue.book.size).toBe(0);
  });
});

describe("AceStrikeGlue online snapshot", () => {
  it("restores an open strike window in place", () => {
    const sender = new AceStrikeGlue();
    const pose = { x: 3000, y: 3000, angle: 0 };
    const acePilot = spawn("a", 0, ace, pose);
    sender.noteFlight(acePilot, ["barrel_roll"], NOW);
    const data = captureGraph({ aceStrike: sender.book });
    const receiver = new AceStrikeGlue();
    receiver.noteFlight(acePilot, [], NOW);
    restoreGraph({ aceStrike: receiver.book }, data);
    const foe = spawn("b", 1, plain, { x: 3000, y: 2800, angle: 180 });
    expect(receiver.takeShotFlags(acePilot, foe, NOW + 100).attackerStrike).toBe(true);
  });
});
