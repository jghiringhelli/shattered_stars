import { describe, it, expect } from "vitest";
import { RelicCombatEngine } from "../../../../src/systems/survival/RelicCombatEngine";
import {
  DRIVE_BOOST_FLOOR,
  driveEffect,
  maxHullMultiplier,
  staticEffectsFor,
  upgradeHull,
  type FleetLoadout,
} from "../../../../src/systems/survival/FleetEffects";
import { fleetModifiers } from "../../../../src/systems/survival/runFlightEquip";
import { combineEffects } from "../../../../src/core/CombatModifiers";
import { DURABILITY_SCALE } from "../../../../src/config";

function loadout(patch: Partial<FleetLoadout> = {}): FleetLoadout {
  return { relicIds: [], mutationIds: [], speed: 0, ...patch };
}

const SHOT = {
  shooterId: "p0",
  role: "flagship" as const,
  targetMarked: false,
  escortsAlive: 0,
  nowMs: 0,
};

describe("FleetEffects", () => {
  it("maps Drive (speed): the first point is a top-speed notch, further points speed up boost recharge", () => {
    expect(driveEffect(0)).toEqual({});
    expect(driveEffect(1)).toEqual({ maxSpeedBonus: 1 });
    const three = combineEffects([driveEffect(3)]);
    expect(three.maxSpeedBonus).toBe(1);
    expect(three.boostCooldownMultiplier).toBeCloseTo(0.85 ** 2);
    expect(three.barrelRollCooldownMultiplier).toBe(1);
    expect(driveEffect(30).boostCooldownMultiplier).toBe(DRIVE_BOOST_FLOOR);
  });

  it("never stacks the top-speed notch past one above the dial", () => {
    expect(
      combineEffects([driveEffect(4), { maxSpeedBonus: 1 }]).maxSpeedBonus,
    ).toBe(1);
  });

  it("gives flagship and escorts the same Drive; flagship-scoped relics only reach the flagship", () => {
    const l = loadout({
      speed: 2,
      relicIds: ["ambush_doctrine", "escort_foundry"],
    });
    const flagship = fleetModifiers(
      combineEffects(staticEffectsFor(l, "flagship", 0)),
      l.speed,
    );
    const escort = fleetModifiers(
      combineEffects(staticEffectsFor(l, "escort", 0)),
      l.speed,
    );
    expect(escort.boostCooldownMultiplier).toBeCloseTo(0.85);
    expect(flagship.boostCooldownMultiplier).toBeCloseTo(0.85);
    expect(escort.maxSpeedBonus).toBe(1);
    expect(flagship.rearArcLaserBonus).toBe(2);
    expect(escort.rearArcLaserBonus).toBe(0);
    expect(escort.laserDamageBonus).toBe(1);
    expect(flagship.laserDamageBonus).toBe(0);
  });

  it("adds upgrade damage and hull per level", () => {
    expect(
      combineEffects(staticEffectsFor(loadout(), "escort", 2)).laserDamageBonus,
    ).toBe(2);
    expect(upgradeHull(2)).toBe(2 * DURABILITY_SCALE);
  });

  it("activates an archetype set bonus at three relics", () => {
    const two = loadout({ relicIds: ["capacitor_bank", "regen_lattice"] });
    const three = loadout({
      relicIds: ["capacitor_bank", "regen_lattice", "ablative_hull"],
    });
    const sheet = (l: FleetLoadout) =>
      combineEffects(staticEffectsFor(l, "escort", 0));
    expect(
      sheet(three).shieldRegenPerSecond - sheet(two).shieldRegenPerSecond,
    ).toBeCloseTo(0.24, 10);
    expect(
      sheet(three).damageTakenMultiplier / sheet(two).damageTakenMultiplier,
    ).toBeCloseTo(0.85, 10);
  });

  it("scales flagship max hull with systems mutations", () => {
    expect(
      maxHullMultiplier(
        loadout({ mutationIds: ["juggernaut_plating"] }),
        "flagship",
      ),
    ).toBe(1.25);
    expect(
      maxHullMultiplier(
        loadout({ mutationIds: ["juggernaut_plating"] }),
        "escort",
      ),
    ).toBe(1);
  });
});

describe("RelicCombatEngine triggers", () => {
  it("after a red maneuver grants Adrenal Injector damage for 3s", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["adrenal_injector"] }),
    );
    expect(engine.onManeuver("p0", "flagship", "white", 0).started).toEqual([]);
    expect(engine.onManeuver("p0", "flagship", "red", 1000).started).toEqual([
      "adrenal",
    ]);
    expect(engine.shot({ ...SHOT, nowMs: 3999 }).damageBonus).toBe(1);
    expect(engine.shot({ ...SHOT, nowMs: 4001 }).damageBonus).toBe(0);
  });

  it("only fires triggers for the player-flown flagship", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["adrenal_injector"] }),
    );
    expect(engine.onManeuver("e1", "escort", "red", 0).started).toEqual([]);
  });

  it("halves incoming damage after a barrel roll with Slipstream Vanes", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["slipstream_vanes"] }),
    );
    engine.onFlightEvent("p0", "flagship", "barrel_roll", 0);
    expect(engine.incomingMultiplier("p0", "flagship", 0, 1000)).toBe(0.5);
    expect(engine.incomingMultiplier("p0", "flagship", 0, 2000)).toBe(1);
  });

  it("scales every incoming hit by the node's enemy lethality, on top of buffs", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["slipstream_vanes"] }),
      0.75,
    );
    expect(engine.incomingMultiplier("e1", "escort", 0, 0)).toBe(0.75);
    engine.onFlightEvent("p0", "flagship", "barrel_roll", 0);
    expect(engine.incomingMultiplier("p0", "flagship", 0, 1000)).toBe(0.375);
  });

  it("restores shields on a barrel roll with Phase Flicker", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["phase_flicker"] }),
    );
    expect(
      engine.onFlightEvent("p0", "flagship", "barrel_roll", 0)
        .shieldRestoreFraction,
    ).toBe(0.15);
    expect(
      engine.onFlightEvent("p0", "flagship", "boost", 0).shieldRestoreFraction,
    ).toBe(0);
  });

  it("refreshes a re-triggered buff instead of stacking it", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["afterburn_capacitor"] }),
    );
    engine.onFlightEvent("p0", "flagship", "boost", 0);
    engine.onFlightEvent("p0", "flagship", "boost", 1000);
    expect(engine.shot({ ...SHOT, nowMs: 1500 }).hitChanceBonus).toBeCloseTo(
      0.15,
    );
    expect(engine.activeBuffs("p0", 3000)).toEqual(["afterburn"]);
  });
});

describe("RelicCombatEngine volley (the fire-rate bonus)", () => {
  it("fires a second bolt on every 10th attack at +10 % volley", () => {
    const engine = new RelicCombatEngine(loadout({}));
    const shots = Array.from(
      { length: 20 },
      () => engine.shot({ ...SHOT, volleyRate: 0.1 }).shots,
    );
    expect(shots.filter((s) => s === 2)).toHaveLength(2);
    expect(shots[9]).toBe(2);
    expect(shots[19]).toBe(2);
  });

  it("charges each shooter on its own", () => {
    const engine = new RelicCombatEngine(loadout({}));
    for (let i = 0; i < 9; i++) engine.shot({ ...SHOT, volleyRate: 0.1 });
    const other = engine.shot({ ...SHOT, shooterId: "b", volleyRate: 0.1 });
    expect(other.shots).toBe(1);
    expect(engine.shot({ ...SHOT, volleyRate: 0.1 }).shots).toBe(2);
  });

  it("never fires more than one extra bolt per attack below +100 %", () => {
    const engine = new RelicCombatEngine(loadout({}));
    const shots = Array.from(
      { length: 30 },
      () => engine.shot({ ...SHOT, volleyRate: 0.45 }).shots,
    );
    expect(Math.max(...shots)).toBe(2);
    expect(shots.filter((s) => s === 2)).toHaveLength(13);
  });

  it("adds nothing without a volley bonus", () => {
    const engine = new RelicCombatEngine(loadout({}));
    expect(engine.shot(SHOT).shots).toBe(1);
  });
});

describe("RelicCombatEngine shots", () => {
  it("rewards marked targets (Target Painter, Predator Optics)", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["target_painter", "predator_optics"] }),
    );
    expect(engine.shot(SHOT)).toMatchObject({
      damageBonus: 0,
      hitChanceBonus: 0,
      critChanceBonus: 0,
    });
    expect(engine.shot({ ...SHOT, targetMarked: true })).toMatchObject({
      damageBonus: 1,
      hitChanceBonus: 0.1,
      critChanceBonus: 0.2,
    });
  });

  it("scales flagship damage with living escorts (Pack Tactics)", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["pack_tactics"] }),
    );
    expect(engine.shot({ ...SHOT, escortsAlive: 1 }).damageBonus).toBe(0);
    expect(engine.shot({ ...SHOT, escortsAlive: 4 }).damageBonus).toBe(2);
  });

  it("protects the flagship while the formation holds (Formation Lock)", () => {
    const engine = new RelicCombatEngine(
      loadout({ relicIds: ["formation_lock"] }),
    );
    expect(engine.incomingMultiplier("p0", "flagship", 1, 0)).toBe(1);
    expect(engine.incomingMultiplier("p0", "flagship", 2, 0)).toBe(0.8);
  });

  it("changes the fire pattern with weapon mutations", () => {
    const rail = new RelicCombatEngine(
      loadout({ mutationIds: ["rail_driver"] }),
    );
    expect(rail.attackIntervalMultiplier("flagship")).toBe(1.8);
    expect(rail.shot(SHOT).damageMultiplier).toBe(2.2);
    expect(rail.rangeBonusPx("flagship")).toBe(120);
    const scatter = new RelicCombatEngine(
      loadout({ mutationIds: ["scatter_array"] }),
    );
    expect(scatter.shot(SHOT).shots).toBe(2);
    expect(scatter.shot({ ...SHOT, role: "escort" }).shots).toBe(1);
  });

  it("swaps passive shield regen for kill/roll restores with Reactive Shields", () => {
    const engine = new RelicCombatEngine(
      loadout({ mutationIds: ["reactive_shields"] }),
    );
    expect(engine.passiveShieldRegen("flagship")).toBe(false);
    expect(engine.passiveShieldRegen("escort")).toBe(true);
    expect(engine.killShieldFraction("flagship")).toBe(0.4);
    expect(
      engine.onFlightEvent("p0", "flagship", "barrel_roll", 0)
        .shieldRestoreFraction,
    ).toBe(0.15);
  });
});
