/**
 * CampaignHeroPowers — the battle-side hero power controller: V/B presses
 * cast unlocked, ready powers; commands reach the scene through a host;
 * timed statuses and delayed strikes resolve over time. And
 * withCampaignBonuses — Armory/Research bonuses applied to a ship.
 */

import { describe, expect, it } from "vitest";
import {
  CampaignHeroPowers,
  type PowerHost,
} from "../../../../src/arcade/systems/CampaignHeroPowers";
import { withCampaignBonuses } from "../../../../src/arcade/systems/CampaignLoadoutBonuses";
import { NEUTRAL_BONUSES } from "../../../../src/campaign/armory/bonusTypes";
import { HeroPowerInput } from "../../../../src/campaign/powers/HeroPowerInput";
import type { PowerWorld } from "../../../../src/campaign/powers/heroPowerEffects";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";
import type { InputEvent } from "../../../../src/input/InputTypes";

/** A host that records every call. */
function recordingHost(): PowerHost & { calls: string[] } {
  const calls: string[] = [];
  const log =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push(`${name}:${JSON.stringify(args)}`);
  return {
    calls,
    damage: log("damage"),
    repair: log("repair"),
    refillShields: log("refillShields"),
    stripShields: log("stripShields"),
    stress: log("stress"),
    spawnDrones: log("spawnDrones"),
    teleport: log("teleport"),
    addMines: log("addMines"),
    strike: log("strike"),
    fx: log("fx"),
  };
}

function inputSource() {
  let cb: ((e: InputEvent) => void) | null = null;
  return {
    press: (intent: InputEvent["intent"]) =>
      cb?.({ intent, timestamp: 0, source: "keyboard", value: 1 }),
    source: {
      onAny: (c: (e: InputEvent) => void) => ((cb = c), 1),
      off: () => true,
    },
  };
}

const WORLD: PowerWorld = {
  flagship: { id: "flag", side: "player", x: 0, y: 0, angle: 0 },
  ships: [
    { id: "flag", side: "player", x: 0, y: 0, angle: 0 },
    { id: "e", side: "enemy", x: 0, y: -300, angle: 0 },
  ],
  focusTargetId: "e",
  worldSize: 6000,
};

describe("CampaignHeroPowers", () => {
  it("casts power 1 on V, starting its cooldown", () => {
    const input = inputSource();
    const powers = new CampaignHeroPowers(
      "terran_hegemony",
      { orbital_strike: 1 },
      1,
      new HeroPowerInput(input.source),
    );
    powers.attach();
    input.press("HERO_POWER_1");
    const cast = powers.update(
      { nowMs: 0, deltaMs: 16, world: WORLD },
      recordingHost(),
    );
    expect(cast).toEqual(["orbital_strike"]);
    expect(powers.slots[0]!.cooldownRemainingMs).toBeGreaterThan(0);
  });

  it("resolves a delayed strike once its delay has passed", () => {
    const host = recordingHost();
    const powers = new CampaignHeroPowers(
      "terran_hegemony",
      { orbital_strike: 1 },
      1,
      new HeroPowerInput(inputSource().source),
    );
    powers.requestCast(0);
    powers.update({ nowMs: 0, deltaMs: 16, world: WORLD }, host);
    expect(host.calls.some((c) => c.startsWith("strike"))).toBe(false);
    powers.update({ nowMs: 2000, deltaMs: 16, world: WORLD }, host);
    expect(host.calls.some((c) => c.startsWith("strike"))).toBe(true);
  });

  it("keeps a locked power silent", () => {
    const host = recordingHost();
    const powers = new CampaignHeroPowers(
      "terran_hegemony",
      { orbital_strike: 1 },
      1,
      new HeroPowerInput(inputSource().source),
    );
    powers.requestCast(1);
    expect(
      powers.update({ nowMs: 0, deltaMs: 16, world: WORLD }, host),
    ).toEqual([]);
    expect(host.calls).toEqual([]);
  });

  it("tracks timed statuses (overcharge halves damage taken, then expires)", () => {
    const powers = new CampaignHeroPowers(
      "terran_hegemony",
      { shield_overcharge: 1 },
      1,
      new HeroPowerInput(inputSource().source),
    );
    powers.requestCast(1);
    powers.update({ nowMs: 1000, deltaMs: 16, world: WORLD }, recordingHost());
    expect(powers.damageTakenMultiplier("flag", 2000)).toBe(0.5);
    expect(powers.damageTakenMultiplier("flag", 60_000)).toBe(1);
  });

  it("slows the enemy side's time while time-slow is active", () => {
    const powers = new CampaignHeroPowers(
      "ascendant_empire",
      { time_slow: 1 },
      1,
      new HeroPowerInput(inputSource().source),
    );
    powers.requestCast(0);
    powers.update({ nowMs: 0, deltaMs: 16, world: WORLD }, recordingHost());
    expect(powers.timeScaleFor("enemy", 100)).toBe(0.5);
    expect(powers.timeScaleFor("player", 100)).toBe(1);
  });
});

describe("withCampaignBonuses", () => {
  const stats = getModeCombatStats("terran_viper", "continuous");
  const ship = {
    maxHull: stats.maxHull,
    maxShields: stats.maxShields,
    combatStats: stats,
    modifiers: NEUTRAL_MODIFIERS,
  };

  it("changes nothing with neutral bonuses", () => {
    expect(withCampaignBonuses(ship, NEUTRAL_BONUSES, true)).toEqual(ship);
  });

  it("scales caps and adds attack, faster secondary reloads, maneuver recharges and regen", () => {
    const next = withCampaignBonuses(
      ship,
      {
        ...NEUTRAL_BONUSES,
        hullMultiplier: 1.5,
        attackBonus: 1,
        secondaryReloadMultiplier: 0.5,
        maneuverRechargeMultiplier: 0.8,
        shieldRegenPerSecond: 2,
        damageTakenMultiplier: 0.8,
      },
      true,
    );
    expect(next.maxHull).toBe(Math.round(stats.maxHull * 1.5));
    expect(next.combatStats.attackDice).toBe(stats.attackDice + 1);
    expect(next.combatStats.weaponCooldown).toBe(stats.weaponCooldown);
    expect(next.modifiers.ordnanceCooldownMultiplier).toBeCloseTo(0.5);
    expect(next.modifiers.turretCooldownMultiplier).toBeCloseTo(0.5);
    expect(next.modifiers.boostCooldownMultiplier).toBeCloseTo(0.8);
    expect(next.modifiers.barrelRollCooldownMultiplier).toBeCloseTo(0.8);
    expect(next.modifiers.kturnCooldownMultiplier).toBeCloseTo(0.8);
    expect(next.modifiers.shieldRegenPerSecond).toBe(
      NEUTRAL_MODIFIERS.shieldRegenPerSecond + 2,
    );
    expect(next.modifiers.damageTakenMultiplier).toBeCloseTo(
      NEUTRAL_MODIFIERS.damageTakenMultiplier * 0.8,
    );
  });

  it("gives the escort bonus to wingmen only", () => {
    const bonuses = { ...NEUTRAL_BONUSES, escortAttackBonus: 1 };
    expect(
      withCampaignBonuses(ship, bonuses, true).combatStats.attackDice,
    ).toBe(stats.attackDice);
    expect(
      withCampaignBonuses(ship, bonuses, false).combatStats.attackDice,
    ).toBe(stats.attackDice + 1);
  });
});
