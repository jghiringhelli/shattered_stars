import { describe, it, expect } from "vitest";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { PILOT_ABILITIES } from "../../../src/systems/PilotAbilities";
import type { FactionId } from "../../../src/config";

/**
 * Faction identity invariants for hero (unique pilot) signature abilities.
 *
 * Every faction owns an EXCLUSIVE set of signature abilities for its heroes.
 * No signature ability may be shared by heroes of two different factions, and
 * every hero must reference an ability that actually exists.
 */

interface HeroCard {
  readonly faction: FactionId;
  readonly abilityId?: string;
  readonly isUnique: boolean;
}

const HERO_CARDS: readonly HeroCard[] = Object.values(PILOT_CARDS).filter(
  (card): card is HeroCard & typeof card =>
    card.isUnique && card.abilityId != null,
);

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

describe("Hero ability identity", () => {
  it("every hero references an ability that exists", () => {
    const missing = HERO_CARDS.filter(
      (h) => PILOT_ABILITIES[h.abilityId!] == null,
    ).map((h) => h.abilityId);
    expect(missing).toEqual([]);
  });

  it("no signature ability is shared across factions", () => {
    const factionsByAbility = new Map<string, Set<FactionId>>();
    for (const hero of HERO_CARDS) {
      const set =
        factionsByAbility.get(hero.abilityId!) ?? new Set<FactionId>();
      set.add(hero.faction);
      factionsByAbility.set(hero.abilityId!, set);
    }

    const shared = [...factionsByAbility.entries()]
      .filter(([, factions]) => factions.size > 1)
      .map(
        ([abilityId, factions]) => `${abilityId}: ${[...factions].join(", ")}`,
      );

    expect(shared).toEqual([]);
  });

  it("each faction fields between 10 and 12 distinct hero abilities", () => {
    for (const faction of FACTIONS) {
      const distinct = new Set(
        HERO_CARDS.filter((h) => h.faction === faction).map(
          (h) => h.abilityId!,
        ),
      );
      expect(
        distinct.size,
        `${faction} distinct hero abilities`,
      ).toBeGreaterThanOrEqual(10);
      expect(
        distinct.size,
        `${faction} distinct hero abilities`,
      ).toBeLessThanOrEqual(12);
    }
  });

  it("every signature ability used by a hero declares the matching requiredFaction", () => {
    const mismatches: string[] = [];
    for (const hero of HERO_CARDS) {
      const ability = PILOT_ABILITIES[hero.abilityId!];
      if (
        ability?.requiredFaction != null &&
        ability.requiredFaction !== hero.faction
      ) {
        mismatches.push(
          `${hero.abilityId} required ${ability.requiredFaction}, used by ${hero.faction}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});
