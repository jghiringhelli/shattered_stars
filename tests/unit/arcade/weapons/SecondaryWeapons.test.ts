/**
 * SecondaryWeapons — the one secondary-weapons runtime every battle mode
 * runs: arsenals per ship, locks, FIRE_SECONDARY / WEAPON_CYCLE, bots'
 * ordnance choices, turrets, missiles/torpedoes in flight, bombs/mines on
 * the field, cloaks — reported as events the scene applies.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SecondaryWeapons } from "../../../../src/arcade/weapons/SecondaryWeapons";
import { HitImmunityLedger } from "../../../../src/arcade/systems/CombatTempo";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";
import { LOCK_ACQUIRE_MS } from "../../../../src/arcade/weapons/TargetLock";
import { BOMB_FUSE_MS } from "../../../../src/arcade/weapons/weaponSpecs";
import {
  CYCLE_DURATION_MS,
  ORDNANCE_DAMAGE_SCALE,
} from "../../../../src/config";
import type {
  OrdnanceDecider,
  WeaponBody,
  WeaponEvent,
  WeaponWorld,
} from "../../../../src/arcade/weapons/weaponTypes";

const WORLD = 6000;
const FRAME = 16;

interface Fixture {
  bodies: WeaponBody[];
  wanted: Record<string, string | null>;
  bots: Set<string>;
}

function world(f: Fixture): WeaponWorld {
  return {
    bodies: () => f.bodies,
    wantedTargetOf: (id) => f.wanted[id] ?? null,
    isBotControlled: (id) => f.bots.has(id),
  };
}

function ship(
  id: string,
  side: string,
  x: number,
  y: number,
  angle = 0,
): WeaponBody {
  return { id, side, x, y, angle, hull: 100, agilityDice: 0 };
}

function run(
  weapons: SecondaryWeapons,
  f: Fixture,
  ms: number,
  startMs = 0,
): WeaponEvent[] {
  const events: WeaponEvent[] = [];
  for (let t = 0; t < ms; t += FRAME) {
    events.push(...weapons.update(world(f), FRAME, startMs + t));
  }
  return events;
}

let ledger: HitImmunityLedger;
let weapons: SecondaryWeapons;
let f: Fixture;

function equip(
  id: string,
  upgradeIds: string[],
  definitionId = "terran_viper",
) {
  weapons.equip(id, { definitionId, upgradeIds, modifiers: NEUTRAL_MODIFIERS });
}

beforeEach(() => {
  ledger = new HitImmunityLedger();
  weapons = new SecondaryWeapons({ worldSize: WORLD, ledger, random: () => 0 });
  f = {
    bodies: [ship("p", "a", 3000, 3000), ship("e", "b", 3000, 2780, 180)],
    wanted: { p: "e" },
    bots: new Set(),
  };
});

describe("launchers", () => {
  it("holds fire until the lock is acquired, then launches and hits", () => {
    equip("p", ["proton_torpedo"]);
    expect(weapons.fire("p", world(f), 0)).toBe("locking");
    run(weapons, f, LOCK_ACQUIRE_MS + FRAME);
    expect(weapons.fire("p", world(f), 600)).toBe("launched");
    expect(weapons.arsenalOf("p")!.slots[0]!.charges).toBe(1);
    expect(ledger.isImmune("p", "e", 600)).toBe(true);
    const events = run(weapons, f, 1000, 600);
    const hit = events.find((e) => e.kind === "hit");
    expect(hit).toMatchObject({
      attackerId: "p",
      targetId: "e",
      weapon: "torpedo",
      damage: 5 * ORDNANCE_DAMAGE_SCALE,
    });
    expect(weapons.shotsInFlight).toHaveLength(0);
  });

  it("reports a refusal when the target is outside the front arc", () => {
    equip("p", ["proton_torpedo"]);
    f.bodies[1] = ship("e", "b", 3000, 3220);
    run(weapons, f, LOCK_ACQUIRE_MS + FRAME);
    expect(weapons.fire("p", world(f), 600)).toBe("out_of_arc");
  });

  it("a_striking_warhead_rolls_its_card_dice_against_the_target_agility", () => {
    // X-Wing: a missile/torpedo attack still rolls against the defender's
    // agility (calculateHitChance, as turrets and primaries do).
    weapons = new SecondaryWeapons({
      worldSize: WORLD,
      ledger,
      random: () => 0.99,
    });
    equip("p", ["proton_torpedo"]);
    run(weapons, f, LOCK_ACQUIRE_MS + FRAME);
    expect(weapons.fire("p", world(f), 600)).toBe("launched");
    const events = run(weapons, f, 1000, 600);
    expect(events.some((e) => e.kind === "hit")).toBe(false);
    expect(weapons.shotsInFlight).toHaveLength(0);
  });

  it("refuses_a_launch_at_a_target_this_attacker_already_hit_this_cycle", () => {
    equip("p", ["proton_torpedo"]);
    run(weapons, f, LOCK_ACQUIRE_MS + FRAME);
    ledger.recordHit("p", "e", 550);
    expect(weapons.fire("p", world(f), 600)).toBe("attacked");
    expect(weapons.arsenalOf("p")!.slots[0]!.charges).toBe(2);
  });

  it("keeps_the_attacker_off_its_target_while_the_warhead_flies", () => {
    // The warhead in flight is the attack: a primary may not land in the
    // same cycle as its impact, however long the flight.
    equip("p", ["proton_torpedo"]);
    f.bodies[1] = ship("e", "b", 3000, 2720);
    run(weapons, f, LOCK_ACQUIRE_MS + FRAME);
    expect(weapons.fire("p", world(f), 600)).toBe("launched");
    const fleeingPxPerS = 300;
    let now = 600;
    while (now < 600 + CYCLE_DURATION_MS + 4 * FRAME) {
      now += FRAME;
      const e: WeaponBody = f.bodies[1]!;
      f.bodies[1] = { ...e, y: e.y - (fleeingPxPerS * FRAME) / 1000 };
      weapons.update(world(f), FRAME, now);
    }
    expect(weapons.shotsInFlight).toHaveLength(1);
    expect(ledger.isImmune("p", "e", now)).toBe(true);
  });

  it("cannot lock a cloaked target", () => {
    equip("p", ["proton_torpedo"]);
    equip("e", [], "confed_raven");
    expect(weapons.toggleCloak("e")).toBe(true);
    run(weapons, f, LOCK_ACQUIRE_MS * 2);
    expect(weapons.fire("p", world(f), 1000)).toBe("no_target");
  });
});

describe("devices", () => {
  it("drops a bomb astern that blasts on its fuse, hitting the dropper too", () => {
    equip("p", ["proton_bomb"]);
    f.bodies[1] = ship("e", "b", 3000, 3100);
    expect(weapons.fire("p", world(f), 0)).toBe("dropped");
    expect(weapons.devicesOnField).toHaveLength(1);
    const events = run(weapons, f, BOMB_FUSE_MS + FRAME);
    expect(events.some((e) => e.kind === "blast")).toBe(true);
    const victims = events
      .filter((e) => e.kind === "hit")
      .map((e) => e.kind === "hit" && e.targetId);
    expect(victims.sort()).toEqual(["e", "p"]);
  });
});

describe("turrets", () => {
  it("swing onto an enemy behind and fire once per cycle", () => {
    equip("p", ["light_laser_turret"]);
    f.bodies[1] = ship("e", "b", 3000, 3120);
    const events = run(weapons, f, 1000);
    const shots = events.filter((e) => e.kind === "turret");
    expect(shots).toHaveLength(1);
    expect(events.find((e) => e.kind === "hit")).toMatchObject({
      weapon: "turret",
      damage: 1,
    });
  });

  it("hold fire on a target immune to this attacker", () => {
    equip("p", ["light_laser_turret"]);
    f.bodies[1] = ship("e", "b", 3000, 3120);
    ledger.recordHit("p", "e", 0);
    expect(
      run(weapons, f, 200).filter((e) => e.kind === "turret"),
    ).toHaveLength(0);
  });
});

describe("bots", () => {
  it("fire what their decider chooses", () => {
    const decide: OrdnanceDecider = (view) =>
      view.arsenal.slots.length > 0 ? { kind: "fire", slot: 0 } : null;
    weapons = new SecondaryWeapons({
      worldSize: WORLD,
      ledger,
      random: () => 0,
      decide,
    });
    equip("p", ["proton_bomb"]);
    f.bots.add("p");
    const events = run(weapons, f, FRAME);
    expect(events.some((e) => e.kind === "drop")).toBe(true);
  });
});

describe("cloak", () => {
  it("only cloak ships can cloak, and firing breaks it", () => {
    equip("p", ["proton_bomb"]);
    expect(weapons.toggleCloak("p")).toBe(false);
    equip("r", ["proton_bomb"], "confed_raven");
    f.bodies.push(ship("r", "a", 2000, 2000));
    expect(weapons.toggleCloak("r")).toBe(true);
    expect(weapons.isCloaked("r")).toBe(true);
    weapons.fire("r", world(f), 0);
    expect(weapons.isCloaked("r")).toBe(false);
  });
});

describe("weapon selection", () => {
  it("cycles the selected slot", () => {
    equip("p", ["proton_torpedo", "proton_bomb"]);
    weapons.cycleWeapon("p");
    expect(weapons.fire("p", world(f), 0)).toBe("dropped");
  });
});

describe("turret manual aim (gunner crew)", () => {
  it("fires only along the gunner's aim and does not auto-track", () => {
    equip("p", ["light_laser_turret"]);
    f.bodies[1] = ship("e", "b", 3000, 3120);
    weapons.aimTurret("p", 90);
    expect(
      run(weapons, f, 600).filter((e) => e.kind === "turret"),
    ).toHaveLength(0);
    expect(weapons.arsenalOf("p")!.turret!.facingDeg).toBe(90);
    weapons.aimTurret("p", 180);
    expect(
      run(weapons, f, 100, 600).filter((e) => e.kind === "turret"),
    ).toHaveLength(1);
  });

  it("tracks on its own again once released", () => {
    equip("p", ["light_laser_turret"]);
    f.bodies[1] = ship("e", "b", 3000, 3120);
    weapons.aimTurret("p", 90);
    weapons.releaseTurret("p");
    expect(
      run(weapons, f, 1000).filter((e) => e.kind === "turret"),
    ).toHaveLength(1);
  });
});
