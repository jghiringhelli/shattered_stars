/**
 * Hero power effects — each activation resolves to plain commands for the
 * battle scene; the status ledger tracks timed effects (damage reduction,
 * rate of fire, cloak, disabled guns, time scale).
 */

import { describe, expect, it } from "vitest";
import {
  resolveHeroPower,
  strikeVictims,
  type PowerShipView,
  type PowerWorld,
} from "../../../src/campaign/powers/heroPowerEffects";
import {
  ENEMY_SIDE_KEY,
  addStatus,
  hasStatus,
  pruneStatuses,
  statusMultiplier,
  type StatusLedger,
} from "../../../src/campaign/powers/statusEffects";
import type { HeroPowerEffect } from "../../../src/campaign/powers/heroPowerTypes";

const FLAG: PowerShipView = {
  id: "flag",
  side: "player",
  x: 0,
  y: 0,
  angle: 90,
};

function world(
  ships: PowerShipView[],
  focusTargetId: string | null = null,
): PowerWorld {
  return {
    flagship: FLAG,
    ships: [FLAG, ...ships],
    focusTargetId,
    worldSize: 6000,
  };
}

function cast(effect: HeroPowerEffect, w: PowerWorld) {
  return resolveHeroPower({ powerId: "p", rank: 1, effect }, w);
}

const enemy = (id: string, x: number): PowerShipView => ({
  id,
  side: "enemy",
  x,
  y: 0,
  angle: 0,
});
const ally = (id: string, x: number): PowerShipView => ({
  id,
  side: "player",
  x,
  y: 0,
  angle: 0,
});

describe("resolveHeroPower", () => {
  it("orbital strike: a delayed blast on the focus target", () => {
    const commands = cast(
      { kind: "orbital_strike", radius: 150, damage: 30, delayMs: 1000 },
      world([enemy("e", 500)], "e"),
    );
    expect(commands).toContainEqual({
      cmd: "strike",
      x: 500,
      y: 0,
      radius: 150,
      damage: 30,
      delayMs: 1000,
    });
  });

  it("orbital strike without a target lands ahead of the flagship", () => {
    const [strike] = cast(
      { kind: "orbital_strike", radius: 150, damage: 30, delayMs: 1000 },
      world([]),
    ).filter((c) => c.cmd === "strike");
    expect(strike).toMatchObject({
      x: expect.closeTo(400, 0),
      y: expect.closeTo(0, 0),
    });
  });

  it("shield overcharge: refill + damage reduction on the flagship", () => {
    const commands = cast(
      {
        kind: "shield_overcharge",
        durationMs: 6000,
        damageTakenMultiplier: 0.5,
      },
      world([]),
    );
    expect(commands).toContainEqual({ cmd: "refillShields", shipId: "flag" });
    expect(commands).toContainEqual({
      cmd: "status",
      shipId: "flag",
      kind: "damage_taken",
      value: 0.5,
      durationMs: 6000,
    });
  });

  it("rally: faster fire for allies in range only", () => {
    const commands = cast(
      { kind: "rally", radius: 800, durationMs: 8000, intervalMultiplier: 0.7 },
      world([ally("near", 300), ally("far", 2000), enemy("e", 100)]),
    );
    const buffed = commands
      .filter((c) => c.cmd === "status")
      .map((c) => c.shipId);
    expect(buffed.sort()).toEqual(["flag", "near"]);
  });

  it("field repair: more for the flagship than for nearby allies", () => {
    const commands = cast(
      {
        kind: "field_repair",
        radius: 600,
        selfHullFraction: 0.3,
        allyHullFraction: 0.15,
      },
      world([ally("w", 100)]),
    );
    expect(commands).toContainEqual({
      cmd: "repair",
      shipId: "flag",
      hullFraction: 0.3,
    });
    expect(commands).toContainEqual({
      cmd: "repair",
      shipId: "w",
      hullFraction: 0.15,
    });
  });

  it("EMP: strips shields, stresses and silences enemies in range", () => {
    const commands = cast(
      { kind: "emp_burst", radius: 450, disableMs: 3000, stress: 0.5 },
      world([enemy("in", 300), enemy("out", 900)]),
    );
    const hit = new Set(
      commands
        .filter((c) => "shipId" in c)
        .map((c) => (c as { shipId: string }).shipId),
    );
    expect(hit).toEqual(new Set(["in"]));
    expect(commands).toContainEqual({ cmd: "stripShields", shipId: "in" });
  });

  it("cloak dash: teleports forward along the heading and cloaks", () => {
    const commands = cast(
      { kind: "cloak_dash", distance: 350, durationMs: 3000 },
      world([]),
    );
    expect(commands[0]).toMatchObject({
      cmd: "teleport",
      shipId: "flag",
      x: expect.closeTo(350, 0),
    });
    expect(commands).toContainEqual({
      cmd: "status",
      shipId: "flag",
      kind: "cloaked",
      value: 1,
      durationMs: 3000,
    });
  });

  it("scatter mines: mines behind the flagship, harming enemies only", () => {
    const [mines] = cast(
      { kind: "scatter_mines", count: 4, damage: 20, spacing: 70 },
      world([]),
    );
    expect(mines).toMatchObject({ cmd: "mines", damage: 20 });
    if (mines?.cmd !== "mines") throw new Error("expected mines");
    expect(mines.points).toHaveLength(4);
    expect(mines.points.every((p) => p.x < 0)).toBe(true);
  });

  it("time slow: a side-wide time scale on the enemy", () => {
    const commands = cast(
      { kind: "time_slow", durationMs: 5000, enemyTimeScale: 0.5 },
      world([]),
    );
    expect(commands).toContainEqual({
      cmd: "status",
      shipId: ENEMY_SIDE_KEY,
      kind: "time_scale",
      value: 0.5,
      durationMs: 5000,
    });
  });

  it("psionic lance: shield-piercing damage on the focus target in range", () => {
    const commands = cast(
      { kind: "psionic_lance", range: 900, damage: 40 },
      world([enemy("e", 500)], "e"),
    );
    expect(commands).toContainEqual({
      cmd: "damage",
      shipId: "e",
      amount: 40,
      ignoreShields: true,
    });
  });

  it("psionic lance falls back to the nearest enemy when no focus is in range", () => {
    const commands = cast(
      { kind: "psionic_lance", range: 900, damage: 40 },
      world([enemy("a", 800), enemy("b", 300), enemy("far", 2000)], "far"),
    );
    expect(commands).toContainEqual({
      cmd: "damage",
      shipId: "b",
      amount: 40,
      ignoreShields: true,
    });
  });

  it("drone swarm: spawns allied drones beside the flagship", () => {
    const commands = cast(
      {
        kind: "drone_swarm",
        shipId: "synth_drone",
        count: 3,
        lifetimeMs: 20000,
      },
      world([]),
    );
    expect(commands[0]).toMatchObject({
      cmd: "spawnDrones",
      shipId: "synth_drone",
      count: 3,
      lifetimeMs: 20000,
    });
  });

  it("strikeVictims finds every ship in the blast radius on its side", () => {
    const ships = [enemy("a", 100), enemy("b", 400), ally("c", 50)];
    expect(
      strikeVictims(ships, { x: 0, y: 0 }, 200, "enemy", 6000).map((s) => s.id),
    ).toEqual(["a"]);
  });
});

describe("status ledger", () => {
  it("multiplies active statuses and expires them", () => {
    let ledger: StatusLedger = [];
    ledger = addStatus(ledger, {
      shipId: "a",
      kind: "damage_taken",
      value: 0.5,
      untilMs: 1000,
    });
    expect(statusMultiplier(ledger, "a", "damage_taken", 500)).toBe(0.5);
    expect(statusMultiplier(ledger, "a", "damage_taken", 1000)).toBe(1);
    expect(hasStatus(ledger, "a", "damage_taken", 500)).toBe(true);
    expect(pruneStatuses(ledger, 2000)).toEqual([]);
  });
});
