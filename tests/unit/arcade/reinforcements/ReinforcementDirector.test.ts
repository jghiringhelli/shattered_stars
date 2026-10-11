import { describe, expect, it } from "vitest";
import { toDeployOption } from "../../../../src/arcade/reinforcements/shipOptions";
import { rulesFor } from "../../../../src/arcade/reinforcements/reinforcementRules";
import {
  ReinforcementDirector,
  type DirectorSetup,
} from "../../../../src/arcade/reinforcements/ReinforcementDirector";
import type { DeployOption } from "../../../../src/arcade/reinforcements/reinforcementTypes";

const opt = (definitionId: string, loadoutId: string | null = null) =>
  toDeployOption({ definitionId, loadoutId })!;

const kestrel = opt("confed_kestrel"); // 42
const wasp = opt("confed_wasp"); // 25
const venom = opt("corsair_venom"); // 24
const talon = opt("corsair_talon"); // 45

const P = "free_confederation";
const E = "void_corsairs";
const TICK = 1000 / 60;

function director(
  overrides: Partial<DirectorSetup> = {},
): ReinforcementDirector {
  let n = 0;
  const setup: DirectorSetup = {
    rules: rulesFor("skirmish", { poolPoints: 300, fieldCapPoints: 100 }),
    playerFaction: P,
    sides: [
      { faction: P, strategy: "balanced", plan: [wasp, kestrel] },
      { faction: E, strategy: "balanced", plan: [venom, talon] },
    ],
    playerCatalog: [wasp, kestrel],
    ownsOutcome: true,
    nextShipId: (faction, pilot) => `${pilot}_${faction}_${n++}`,
    ...overrides,
  };
  return new ReinforcementDirector(setup);
}

/** Opening squads: the player's kestrel + a wasp wingman; two venoms. */
function opened(d = director()): ReinforcementDirector {
  d.registerInitial("player_0", P, kestrel, "player");
  d.registerInitial("ally_0", P, wasp, "wingman");
  d.registerInitial("enemy_0", E, venom, "ai");
  d.registerInitial("enemy_1", E, venom, "ai");
  return d;
}

const cost = (options: readonly DeployOption[]) =>
  options.reduce((s, o) => s + o.cost, 0);

describe("ReinforcementDirector", () => {
  it("spends the opening squads from the pools", () => {
    const d = opened();
    expect(d.summary(P).remainingPoints).toBe(300 - cost([kestrel, wasp]));
    expect(d.summary(E).fieldPoints).toBe(cost([venom, venom]));
    expect(d.playerShipId).toBe("player_0");
  });

  it("an AI side fills free field room at once, never past the cap", () => {
    const d = opened();
    const deployed = d.tick(TICK);
    const enemy = deployed.filter((x) => x.faction === E);
    expect(enemy.length).toBeGreaterThan(0);
    expect(enemy[0]?.option).toBe(venom);
    expect(d.summary(E).fieldPoints).toBeLessThanOrEqual(100);
    expect(enemy.every((x) => x.pilot === "ai")).toBe(true);
  });

  it("replaces a destroyed AI ship immediately and spends its pool", () => {
    const d = opened();
    d.tick(TICK);
    const before = d.summary(E).remainingPoints;
    d.shipDestroyed("enemy_0");
    const deployed = d.tick(TICK).filter((x) => x.faction === E);
    expect(deployed.length).toBeGreaterThan(0);
    expect(d.summary(E).remainingPoints).toBe(
      before - cost(deployed.map((x) => x.option)),
    );
    expect(d.summary(E).fieldPoints).toBeLessThanOrEqual(100);
  });

  it("numbers arrivals per side so they fan out", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    d.shipDestroyed("enemy_1");
    const slots = d
      .tick(TICK)
      .filter((x) => x.faction === E)
      .map((x) => x.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("replaces the player's wingmen from the reserve", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("ally_0");
    const ally = d.tick(TICK).filter((x) => x.faction === P);
    expect(ally.length).toBeGreaterThan(0);
    expect(ally.every((x) => x.pilot === "wingman")).toBe(true);
  });

  it("opens the picker when the player's ship is lost and holds wingmen for it", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("player_0");
    d.shipDestroyed("ally_0");
    expect(d.picker).not.toBeNull();
    expect(d.tick(TICK).filter((x) => x.faction === P)).toEqual([]);
    expect(d.picker?.options[0]?.isDefault).toBe(true);
  });

  it("the picker auto-deploys the default after the countdown", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("player_0");
    const defaultOption = d.picker!.options[0]!.option;
    let deployed: ReturnType<ReinforcementDirector["tick"]> = [];
    for (let t = 0; t < 5000 + 2 * TICK && deployed.length === 0; t += TICK)
      deployed = d.tick(TICK).filter((x) => x.pilot === "player");
    expect(deployed).toHaveLength(1);
    expect(deployed[0]!.option).toBe(defaultOption);
    expect(d.picker).toBeNull();
    expect(d.playerShipId).toBe(deployed[0]!.shipId);
  });

  it("choosing another allowed option deploys it at once", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("player_0");
    const index = d.picker!.options.findIndex(
      (o) => !o.isDefault && o.check.allowed,
    );
    const chosen = d.picker!.options[index]!.option;
    const deployment = d.choose(index);
    expect(deployment?.option).toBe(chosen);
    expect(deployment?.pilot).toBe("player");
    expect(d.picker).toBeNull();
  });

  it("refuses a disabled option and keeps the picker open", () => {
    const d = opened(
      director({
        rules: rulesFor("skirmish", { poolPoints: 120, fieldCapPoints: 100 }),
      }),
    );
    d.tick(TICK);
    d.shipDestroyed("player_0");
    const index = d.picker!.options.findIndex((o) => !o.check.allowed);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(d.choose(index)).toBeNull();
    expect(d.picker).not.toBeNull();
  });

  it("a side whose pool is exhausted with nothing alive loses", () => {
    const d = opened(
      director({
        rules: rulesFor("skirmish", { poolPoints: 70, fieldCapPoints: 100 }),
      }),
    );
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    d.shipDestroyed("enemy_1");
    d.tick(TICK);
    expect(d.result).toMatchObject({ winner: "player", reason: "exhaustion" });
    expect(d.canField("enemy")).toBe(false);
    expect(d.canField("player")).toBe(true);
  });

  it("at 3:00 the side that destroyed more points wins", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    d.debugAdvanceClock(180_000);
    d.tick(TICK);
    expect(d.result).toMatchObject({ winner: "player", reason: "time" });
    expect(d.remainingMs).toBe(0);
  });

  it("leaves the outcome to the scenario when it does not own it", () => {
    const d = opened(director({ ownsOutcome: false }));
    d.debugAdvanceClock(400_000);
    d.tick(TICK);
    expect(d.result).toBeNull();
  });

  it("waits the AI deploy delay after a loss", () => {
    const rules = {
      ...rulesFor("skirmish", { poolPoints: 300, fieldCapPoints: 100 }),
      aiDeployDelayMs: 1000,
    };
    const d = opened(director({ rules }));
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    expect(d.tick(TICK).filter((x) => x.faction === E)).toEqual([]);
    d.debugAdvanceClock(1000);
    expect(d.tick(TICK).filter((x) => x.faction === E).length).toBeGreaterThan(
      0,
    );
  });

  it("previews the player's next reserve ships", () => {
    const d = opened();
    expect(d.reservePreview(3).map((o) => o.definitionId)).toEqual([
      "confed_wasp",
      "confed_kestrel",
      "confed_wasp",
    ]);
  });

  it("reports deploy and loss counts for the end screen", () => {
    const d = opened();
    d.tick(TICK);
    d.shipDestroyed("enemy_0");
    const stats = d.matchStats();
    expect(stats.player.deployed).toBeGreaterThanOrEqual(2);
    expect(stats.player.destroyedPoints).toBe(venom.cost);
    expect(stats.enemy.lostPoints).toBe(venom.cost);
  });
});
