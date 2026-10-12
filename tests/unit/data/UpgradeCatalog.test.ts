import { describe, it, expect } from "vitest";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import type { UpgradeDefinition } from "../../../src/core/upgradeTypes";
import { AURA_GRANTING_CREW } from "../../../src/systems/aura/FactionAuras";

const CARDS = Object.values(UPGRADE_DEFINITIONS);
const WEAPON_SLOTS = new Set(["missile", "torpedo", "bomb", "turret"]);
const ORDNANCE_SLOTS = new Set(["missile", "torpedo", "bomb"]);

/** Whether a card changes anything in real-time combat. */
function hasRealtimeConsequence(card: UpgradeDefinition): boolean {
  const realtime = card.realtime ?? {};
  const hasStat =
    (card.effects?.hullBonus ?? 0) !== 0 ||
    (card.effects?.shieldBonus ?? 0) !== 0;
  return (
    Object.keys(realtime).length > 0 || card.weapon !== undefined || hasStat
  );
}

/** The gameplay-relevant fingerprint of a card (ignores name/price/text). */
function gameplayFingerprint(card: UpgradeDefinition): string {
  return JSON.stringify({
    hull: card.effects?.hullBonus ?? 0,
    shields: card.effects?.shieldBonus ?? 0,
    attack: card.effects?.attackBonus ?? 0,
    agility: card.effects?.agilityBonus ?? 0,
    charges: card.effects?.chargesAdded ?? 0,
    realtime: card.realtime ?? {},
    weapon: card.weapon ?? null,
  });
}

/** Whether a card carries a cost in play (a stat or multiplier going the wrong way). */
function hasDrawback(card: UpgradeDefinition): boolean {
  const realtime = card.realtime ?? {};
  const worseMultiplier = [
    realtime.damageTakenMultiplier,
    realtime.stressRateMultiplier,
  ].some((value) => (value ?? 1) > 1);
  const negativeStat = Object.values(card.effects ?? {}).some(
    (value) => typeof value === "number" && value < 0,
  );
  return worseMultiplier || negativeStat;
}

describe("upgrade catalog", () => {
  it("gives every card a real-time effect in battle", () => {
    const inert = CARDS.filter((card) => !hasRealtimeConsequence(card)).map(
      (card) => card.id,
    );
    expect(inert).toEqual([]);
  });

  it("gives every turret and ordnance card a weapon profile", () => {
    const missing = CARDS.filter(
      (card) => WEAPON_SLOTS.has(card.slotType) && !card.weapon,
    ).map((card) => card.id);
    expect(missing).toEqual([]);
  });

  it("only gives weapon profiles to turret and ordnance cards", () => {
    const misplaced = CARDS.filter(
      (card) => card.weapon && !WEAPON_SLOTS.has(card.slotType),
    ).map((card) => card.id);
    expect(misplaced).toEqual([]);
  });

  it("states a charge count on every ordnance card", () => {
    const missing = CARDS.filter(
      (card) =>
        ORDNANCE_SLOTS.has(card.slotType) && !card.effects?.chargesAdded,
    ).map((card) => card.id);
    expect(missing).toEqual([]);
  });

  it("has no two cards in the same slot that play identically", () => {
    const seen = new Map<string, string>();
    const reskins: string[] = [];
    for (const card of CARDS) {
      const key = `${card.slotType}|${gameplayFingerprint(card)}`;
      const twin = seen.get(key);
      if (twin) reskins.push(`${twin} = ${card.id}`);
      seen.set(key, card.id);
    }
    expect(reskins).toEqual([]);
  });

  it("prices every card with a positive fixed point value", () => {
    const unpriced = CARDS.filter(
      (card) => !Number.isInteger(card.pointCost) || card.pointCost <= 0,
    ).map((card) => card.id);
    expect(unpriced).toEqual([]);
  });

  it("offers an illicit category", () => {
    const illicit = CARDS.filter((card) => card.slotType === "illicit");
    expect(illicit.length).toBeGreaterThanOrEqual(3);
  });

  it("pairs every illicit card with a drawback", () => {
    const free = CARDS.filter(
      (card) => card.slotType === "illicit" && !hasDrawback(card),
    ).map((card) => card.id);
    expect(free).toEqual([]);
  });

  it("never counts a card twice: a stat bonus is dropped when the card has its real-time knob", () => {
    // One representation per card (damage rules unified across modes):
    // attack dice vs laser damage, agility dice vs damage taken.
    const doubled = CARDS.filter((card) => {
      const effects = card.effects ?? {};
      const realtime = card.realtime ?? {};
      const attackTwice =
        (effects.attackBonus ?? 0) !== 0 &&
        (realtime.laserDamageBonus ?? 0) !== 0;
      const agilityTwice =
        (effects.agilityBonus ?? 0) !== 0 &&
        (realtime.damageTakenMultiplier ?? 1) !== 1;
      return attackTwice || agilityTwice;
    }).map((card) => card.id);
    expect(doubled).toEqual([]);
  });

  it("gives the Heavy Laser Cannon +1 damage once (laser knob, no attack die)", () => {
    const hlc = UPGRADE_DEFINITIONS["heavy_laser_cannon"];
    expect(hlc?.realtime?.laserDamageBonus).toBe(1);
    expect(hlc?.effects?.attackBonus ?? 0).toBe(0);
  });

  it("derives the aura-granting set from cards that project an aura", () => {
    const projecting = CARDS.filter((card) => card.realtime?.projectsAura).map(
      (card) => card.id,
    );
    expect([...AURA_GRANTING_CREW].sort()).toEqual(projecting.sort());
  });
});
