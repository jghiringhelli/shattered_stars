/**
 * Every card and every pilot ability works in every battle mode —
 * specification tests.
 *
 * 1. Every real-time knob has a probe that drives the SHARED consumer the
 *    modes call (resolveDiceAttack, damageMitigationOf, repairStep,
 *    stressModifiersOf, equipFlight, createArsenal, the aura resolver, the
 *    kill / death-blast hooks) and sees the knob change the outcome. The
 *    probe table is typed over every CombatModifiers key, so a new knob
 *    cannot ship without a consumer.
 * 2. Every upgrade card and pilot ability: each knob it sets passes its
 *    probe; weapon cards arm a secondary; stat cards raise hull/shields.
 * 3. Every battle mode's scene calls each shared consumer, so a card that
 *    works through them works in that mode.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  NEUTRAL_MODIFIERS,
  combineEffects,
  type CombatModifiers,
  type RealtimeEffect,
} from "../../../src/core/CombatModifiers";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { createArsenal } from "../../../src/arcade/weapons/Arsenal";
import { buildsFlyingCard } from "../../../src/data/quickBuildIndex";
import { applyLoadoutEffects } from "../../../src/systems/BattleHelpers";
import { getModeCombatStats } from "../../../src/data/ModeBalancing";
import { MODE_WIRING, MODE_CONSUMERS } from "./modeWiring";
import { KNOB_PROBES } from "./knobProbes";

const ROOT = resolve(__dirname, "../../..");

/** Knobs an effect sets to a non-neutral value. */
function activeKnobs(effect: RealtimeEffect): (keyof CombatModifiers)[] {
  return (Object.keys(effect) as (keyof CombatModifiers)[]).filter(
    (key) =>
      effect[key] !== undefined && effect[key] !== NEUTRAL_MODIFIERS[key],
  );
}

/** Knobs of an effect whose shared consumer sees no change. */
function deadKnobs(effect: RealtimeEffect): string[] {
  const sheet = combineEffects([effect]);
  return activeKnobs(effect).filter((knob) => !KNOB_PROBES[knob](sheet));
}

describe("every knob has a shared consumer that reacts to it", () => {
  it.each(Object.keys(KNOB_PROBES) as (keyof CombatModifiers)[])(
    "%s changes an outcome in its shared consumer",
    (knob) => {
      const neutral = NEUTRAL_MODIFIERS[knob];
      const value =
        typeof neutral === "boolean" ? true : neutral === 1 ? 0.8 : 1;
      expect(KNOB_PROBES[knob](combineEffects([{ [knob]: value }]))).toBe(true);
    },
  );

  it("a neutral sheet changes nothing", () => {
    const reacting = (
      Object.keys(KNOB_PROBES) as (keyof CombatModifiers)[]
    ).filter((knob) => KNOB_PROBES[knob](NEUTRAL_MODIFIERS));
    expect(reacting).toEqual([]);
  });
});

describe("every upgrade card has a live real-time effect", () => {
  const cards = Object.values(UPGRADE_DEFINITIONS);

  it("every knob a card sets reaches its consumer", () => {
    const dead = cards.flatMap((card) =>
      deadKnobs(card.realtime ?? {}).map((knob) => `${card.id}.${knob}`),
    );
    expect(dead).toEqual([]);
  });

  it("every weapon card arms a secondary weapon", () => {
    const unarmed = cards
      .filter((card) => card.weapon)
      .filter((card) => {
        const arsenal = createArsenal({
          definitionId: "terran_gladius",
          upgradeIds: [card.id],
          modifiers: NEUTRAL_MODIFIERS,
        });
        return arsenal.slots.length === 0 && arsenal.turret === null;
      })
      .map((card) => card.id);
    expect(unarmed).toEqual([]);
  });

  it("every stat card raises hull or shields on the builds that fly it", () => {
    const inert = cards
      .filter((card) => card.effects?.hullBonus || card.effects?.shieldBonus)
      .filter((card) => {
        const build = buildsFlyingCard(card.id)[0];
        if (!build) return true;
        const stats = getModeCombatStats(build.shipId, "continuous");
        const ship = { definitionId: build.shipId, ...stats };
        const before = ship.maxHull + ship.maxShields;
        applyLoadoutEffects(ship, build.id);
        return ship.maxHull + ship.maxShields === before;
      })
      .map((card) => card.id);
    expect(inert).toEqual([]);
  });
});

describe("every pilot ability has a live real-time effect", () => {
  it("every knob an ability sets reaches its consumer", () => {
    const dead = Object.entries(PILOT_ABILITY_REALTIME).flatMap(
      ([id, effect]) => deadKnobs(effect).map((knob) => `${id}.${knob}`),
    );
    expect(dead).toEqual([]);
  });
});

describe("every battle mode calls the shared consumers", () => {
  it.each(Object.entries(MODE_WIRING))("%s", (_mode, files) => {
    const source = files
      .map((file) => readFileSync(resolve(ROOT, file), "utf8"))
      .join("\n");
    const missing = Object.entries(MODE_CONSUMERS)
      .filter(([, names]) => !names.some((name) => source.includes(name)))
      .map(([consumer]) => consumer);
    expect(missing).toEqual([]);
  });
});
