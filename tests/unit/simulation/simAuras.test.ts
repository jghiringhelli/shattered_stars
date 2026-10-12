import { describe, it, expect } from "vitest";
import { NEUTRAL_MODIFIERS } from "../../../src/core/CombatModifiers";
import {
  DamagePauseTracker,
  updateSimAuras,
  type SimAuraShip,
} from "../../../src/simulation/simAuras";
import {
  addShip,
  createArenaLoop,
  livingOf,
} from "../../../src/simulation/arenaLoop";

const TICK = 1000 / 60;
const SECOND = 1000;

function ship(
  overrides: Partial<SimAuraShip> & { side?: string },
): SimAuraShip & { side: string } {
  return {
    id: "s",
    definitionId: "terran_viper",
    loadoutId: null,
    x: 1000,
    y: 1000,
    hull: 24,
    maxHull: 24,
    shields: 12,
    maxShields: 12,
    modifiers: NEUTRAL_MODIFIERS,
    side: "A",
    ...overrides,
  };
}

describe("updateSimAuras", () => {
  it("repairs a ship's own hull only after a quiet spell", () => {
    const repairing = { ...NEUTRAL_MODIFIERS, hullRepairPerSecond: 12 };
    const s = ship({ hull: 12, modifiers: repairing });
    const tracker = new DamagePauseTracker();
    updateSimAuras([s], (x) => x.side, tracker, TICK);
    s.hull = 6; // hit
    updateSimAuras([s], (x) => x.side, tracker, TICK);
    expect(s.hull).toBe(6);
    for (let t = 0; t < 10 * SECOND; t += TICK)
      updateSimAuras([s], (x) => x.side, tracker, TICK);
    expect(s.hull).toBeGreaterThan(6);
  });

  it("lets a support ship cover allies of its side, never the enemy", () => {
    const support = ship({ id: "sup", definitionId: "ascendant_acolyte" });
    const ally = ship({
      id: "ally",
      definitionId: "ascendant_cherub",
      x: 1040,
    });
    const foe = ship({
      id: "foe",
      definitionId: "ascendant_cherub",
      x: 1060,
      side: "B",
    });
    const auras = updateSimAuras(
      [support, ally, foe],
      (x) => x.side,
      new DamagePauseTracker(),
      TICK,
    );
    expect(auras.has("ally")).toBe(true);
    expect(auras.has("foe")).toBe(false);
  });
});

describe("arenaLoop", () => {
  it("arms and flies a ship that joins mid-battle", () => {
    const loop = createArenaLoop({
      A: {
        ships: [{ definitionId: "terran_viper", tier: "average" }],
        squad: {},
      },
      B: {
        ships: [{ definitionId: "confed_raven", tier: "average" }],
        squad: {},
      },
      seed: 3,
    });
    addShip(loop, {
      id: "R0",
      side: "A",
      definitionId: "terran_stiletto",
      loadoutId: null,
      skill: { tier: "average", reactionScale: 1 },
      pose: { x: 500, y: 500, angle: 0 },
    });
    expect(livingOf(loop, "A").map((s) => s.id)).toContain("R0");
  });
});
