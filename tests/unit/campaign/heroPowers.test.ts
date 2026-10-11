/**
 * Hero powers — unlock schedule, cooldowns and per-faction distinctness.
 */

import { describe, expect, it } from "vitest";
import {
  activateHeroPower,
  createHeroPowerSlots,
  heroPowerRanksFor,
  slotCooldownFraction,
  tickHeroPowers,
} from "../../../src/campaign/powers/heroPowerState";
import { FACTION_HEROES } from "../../../src/data/campaign/heroPowers";
import { HeroPowerInput } from "../../../src/campaign/powers/HeroPowerInput";
import type { InputEvent } from "../../../src/input/InputTypes";

describe("hero roster", () => {
  it("gives every faction two powers, all distinct across factions", () => {
    const ids = Object.values(FACTION_HEROES).flatMap((h) =>
      h.powers.map((p) => p.id),
    );
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  it("gets cheaper to cast as a power ranks up", () => {
    for (const hero of Object.values(FACTION_HEROES)) {
      for (const power of hero.powers) {
        const [r1, r2, r3] = power.ranks;
        expect(r2.cooldownMs).toBeLessThanOrEqual(r1.cooldownMs);
        expect(r3.cooldownMs).toBeLessThanOrEqual(r2.cooldownMs);
      }
    }
  });
});

describe("unlock schedule", () => {
  it("starts with only the first power at rank 1", () => {
    expect(heroPowerRanksFor("terran_hegemony", 0)).toEqual({
      orbital_strike: 1,
      shield_overcharge: 0,
    });
  });

  it("unlocks the second power and ranks both up as missions complete", () => {
    expect(heroPowerRanksFor("terran_hegemony", 3)).toEqual({
      orbital_strike: 1,
      shield_overcharge: 1,
    });
    expect(heroPowerRanksFor("terran_hegemony", 15)).toEqual({
      orbital_strike: 3,
      shield_overcharge: 3,
    });
  });
});

describe("cooldowns", () => {
  const ranks = { cloak_dash: 1, scatter_mines: 0 };

  it("casts a ready power and starts its cooldown", () => {
    const slots = createHeroPowerSlots("void_corsairs", ranks);
    const { slots: after, activation } = activateHeroPower(slots, 0);
    expect(activation).toMatchObject({ powerId: "cloak_dash", rank: 1 });
    expect(after[0]!.cooldownRemainingMs).toBe(20_000);
    expect(slotCooldownFraction(after[0]!)).toBe(1);
  });

  it("refuses a power on cooldown, then allows it once recharged", () => {
    let slots = activateHeroPower(
      createHeroPowerSlots("void_corsairs", ranks),
      0,
    ).slots;
    expect(activateHeroPower(slots, 0).activation).toBeNull();
    slots = tickHeroPowers(slots, 20_000);
    expect(activateHeroPower(slots, 0).activation).not.toBeNull();
  });

  it("refuses a locked power", () => {
    const slots = createHeroPowerSlots("void_corsairs", ranks);
    expect(activateHeroPower(slots, 1).activation).toBeNull();
  });

  it("applies a research cooldown multiplier", () => {
    const slots = createHeroPowerSlots("void_corsairs", ranks, 0.8);
    expect(activateHeroPower(slots, 0).slots[0]!.cooldownRemainingMs).toBe(
      16_000,
    );
  });
});

describe("HeroPowerInput", () => {
  /** A minimal intent source that records its subscriber. */
  function fakeSource(): {
    emit: (intent: InputEvent["intent"]) => void;
    source: ConstructorParameters<typeof HeroPowerInput>[0];
    subscribers: () => number;
  } {
    let callback: ((e: InputEvent) => void) | null = null;
    return {
      emit: (intent) =>
        callback?.({ intent, timestamp: 0, source: "keyboard", value: 1 }),
      source: {
        onAny: (cb) => {
          callback = cb;
          return 1;
        },
        off: () => {
          callback = null;
          return true;
        },
      },
      subscribers: () => (callback ? 1 : 0),
    };
  }

  it("latches HERO_POWER_1/2 presses until taken, once each", () => {
    const fake = fakeSource();
    const input = new HeroPowerInput(fake.source);
    input.attach();
    fake.emit("HERO_POWER_2");
    fake.emit("MARK_TARGET");
    expect(input.takeRequests()).toEqual([1]);
    expect(input.takeRequests()).toEqual([]);
  });

  it("releases its subscription on detach", () => {
    const fake = fakeSource();
    const input = new HeroPowerInput(fake.source);
    input.attach();
    input.detach();
    expect(fake.subscribers()).toBe(0);
  });
});
