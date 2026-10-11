/**
 * Hazard models — ion storm (drains shields, stresses), minefield (one-shot
 * blasts, optionally side-owned), asteroid belt (periodic impacts while
 * inside) and a flare wall advancing across the field. Pure, deterministic.
 */

import { describe, expect, it } from "vitest";
import {
  createHazardState,
  hazardVisuals,
  setHazardActive,
  stepHazards,
  type HazardShip,
} from "../../../src/campaign/hazards/hazardModel";
import type { HazardDefinition } from "../../../src/campaign/hazards/hazardTypes";

const WORLD = 6000;

function ship(
  id: string,
  x: number,
  y = 0,
  side: "player" | "enemy" = "player",
): HazardShip {
  return { id, x, y, side };
}

describe("ion storm", () => {
  const storm: HazardDefinition = {
    id: "ion",
    kind: "ion_storm",
    at: { x: 0, y: 0 },
    radius: 300,
    shieldDrainPerSecond: 10,
    stressPerSecond: 0.1,
  };

  it("drains shields and stresses ships inside it, per second", () => {
    const { effects } = stepHazards(
      createHazardState([storm]),
      [ship("a", 100), ship("b", 900)],
      500,
      WORLD,
    );
    expect(effects).toEqual([
      { shipId: "a", hullDamage: 0, shieldDrain: 5, stress: 0.05 },
    ]);
  });

  it("does nothing while switched off by a script", () => {
    const off = setHazardActive(createHazardState([storm]), "ion", false);
    expect(stepHazards(off, [ship("a", 0)], 1000, WORLD).effects).toEqual([]);
  });
});

describe("minefield", () => {
  const mines: HazardDefinition = {
    id: "mines",
    kind: "minefield",
    mines: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ],
    triggerRadius: 60,
    damage: 40,
  };

  it("detonates a mine once when a ship comes close", () => {
    let state = createHazardState([mines]);
    const first = stepHazards(state, [ship("a", 30)], 16, WORLD);
    expect(first.effects).toEqual([
      { shipId: "a", hullDamage: 40, shieldDrain: 0, stress: 0 },
    ]);
    state = first.state;
    expect(stepHazards(state, [ship("a", 30)], 16, WORLD).effects).toEqual([]);
    expect(hazardVisuals(state)).toHaveLength(1);
  });

  it("an owned minefield only harms the other side", () => {
    const owned: HazardDefinition = { ...mines, harms: "enemy" };
    const result = stepHazards(
      createHazardState([owned]),
      [ship("p", 0), ship("e", 1000, 0, "enemy")],
      16,
      WORLD,
    );
    expect(result.effects.map((e) => e.shipId)).toEqual(["e"]);
  });
});

describe("asteroid belt", () => {
  const belt: HazardDefinition = {
    id: "rocks",
    kind: "asteroid_belt",
    at: { x: 0, y: 0 },
    radius: 400,
    damagePerHit: 15,
    hitIntervalMs: 1000,
  };

  it("hits a ship once per interval spent inside", () => {
    let state = createHazardState([belt]);
    const hits: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = stepHazards(state, [ship("a", 0)], 500, WORLD);
      state = result.state;
      hits.push(result.effects.length);
    }
    expect(hits).toEqual([0, 1, 0, 1, 0]);
  });
});

describe("flare wall", () => {
  const wall: HazardDefinition = {
    id: "flare",
    kind: "flare_wall",
    axis: "x",
    start: 0,
    stop: 2000,
    speed: 100,
    damagePerSecond: 20,
  };

  it("advances and burns every ship it has passed", () => {
    let state = createHazardState([wall]);
    state = stepHazards(state, [], 5000, WORLD).state;
    const { effects } = stepHazards(
      state,
      [ship("a", 300), ship("b", 800)],
      1000,
      WORLD,
    );
    expect(effects).toEqual([
      { shipId: "a", hullDamage: 20, shieldDrain: 0, stress: 0 },
    ]);
  });

  it("stops at its limit", () => {
    let state = createHazardState([wall]);
    state = stepHazards(state, [], 60_000, WORLD).state;
    expect(hazardVisuals(state)[0]).toMatchObject({
      kind: "flare_wall",
      position: 2000,
    });
  });
});
