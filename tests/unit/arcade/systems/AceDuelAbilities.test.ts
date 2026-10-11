import { describe, expect, it } from "vitest";
import {
  adHocAbilities,
  duelModifiers,
  duelShotOdds,
  isSheetAbility,
  marksmanshipDamage,
  MARKSMANSHIP_EXTRA_DAMAGE,
  type DuelAbilityShip,
} from "../../../../src/arcade/systems/AceDuelAbilities";
import { resolveLoadoutModifiers } from "../../../../src/arcade/ArcadeUpgradeEffects";
import {
  combineEffects,
  NEUTRAL_MODIFIERS,
} from "../../../../src/core/CombatModifiers";
import { ACE_MATCHUPS } from "../../../../src/data/AceMatchups";
import { calculateHitChance } from "../../../../src/data/ModeBalancing";
import { PILOT_ABILITY_REALTIME } from "../../../../src/data/pilotAbilityEffects";

const ATTACK_DICE = 3;
const AGILITY_DICE = 2;
const MAX_HULL = 10;
const WOUNDED_HULL = 4;
const SCRATCHED_HULL = 9;

/** Duel abilities with no real-time entry (and none planned). */
const AD_HOC_ONLY = ["marksmanship", "stealth_device"] as const;

/** Duel abilities whose real-time entry ships with pilot cards. */
const CARD_SHEET_ABILITIES = [
  "predator",
  "fearless",
  "supernatural_reflexes",
  "networked_aim",
] as const;

const DUEL_ABILITIES = [
  ...new Set(
    ACE_MATCHUPS.flatMap((m) => [...m.side1.abilities, ...m.side2.abilities]),
  ),
];

/**
 * @param overrides - Fields that matter to the test.
 * @returns A full-hull duel ship with no abilities by default.
 */
function duelShip(overrides: Partial<DuelAbilityShip> = {}): DuelAbilityShip {
  return {
    abilities: [],
    hull: MAX_HULL,
    maxHull: MAX_HULL,
    combatStats: { attackDice: ATTACK_DICE, agilityDice: AGILITY_DICE },
    ...overrides,
  };
}

const BASE_HIT_CHANCE = calculateHitChance(ATTACK_DICE, AGILITY_DICE);
const ONE_MORE_ATTACK_DIE = calculateHitChance(ATTACK_DICE + 1, AGILITY_DICE);
const ONE_MORE_DEFENSE_DIE = calculateHitChance(ATTACK_DICE, AGILITY_DICE + 1);

/**
 * @param abilityId - The ability under test.
 * @param adHocChance - Hit chance when it acts ad hoc.
 * @returns The hit chance the spec expects: base when it lives on the sheet.
 */
function expectedChance(abilityId: string, adHocChance: number): number {
  return isSheetAbility(abilityId) ? BASE_HIT_CHANCE : adHocChance;
}

describe("isSheetAbility", () => {
  it.each(CARD_SHEET_ABILITIES)(
    "routes_%s_through_the_modifier_sheet",
    (id) => {
      expect(isSheetAbility(id)).toBe(true);
    },
  );

  it.each(AD_HOC_ONLY)("keeps_%s_ad_hoc", (id) => {
    expect(isSheetAbility(id)).toBe(false);
  });

  it.each(DUEL_ABILITIES)("matches_the_realtime_table_for_%s", (id) => {
    expect(isSheetAbility(id)).toBe(PILOT_ABILITY_REALTIME[id] !== undefined);
  });

  it("ignores_object_prototype_keys", () => {
    expect(isSheetAbility("constructor")).toBe(false);
  });
});

describe("adHocAbilities", () => {
  it("drops_sheet_abilities_and_keeps_the_rest_in_order", () => {
    expect(
      adHocAbilities(["stealth_device", "predator", "marksmanship"]),
    ).toEqual(["stealth_device", "marksmanship"]);
  });
});

describe("duelModifiers", () => {
  it("folds_a_sheet_ability_into_the_bare_hull_sheet", () => {
    const sheet = duelModifiers(NEUTRAL_MODIFIERS, ["fearless"], null);
    expect(sheet.stressedLaserBonus).toBe(1);
  });

  it("leaves_the_sheet_untouched_for_ad_hoc_abilities", () => {
    const sheet = duelModifiers(NEUTRAL_MODIFIERS, [...AD_HOC_ONLY], null);
    expect(sheet).toEqual(NEUTRAL_MODIFIERS);
  });

  it("folds_every_sheet_ability_of_an_ace", () => {
    const abilities = DUEL_ABILITIES.filter(isSheetAbility);
    const sheet = duelModifiers(NEUTRAL_MODIFIERS, abilities, null);
    const expected = combineEffects(
      abilities.map((id) => PILOT_ABILITY_REALTIME[id]!),
    );
    expect(sheet).toEqual(expected);
  });

  it("keeps_the_quick_build_sheet_alongside_the_ace_abilities", () => {
    const loadoutSheet = combineEffects([{ laserDamageBonus: 1 }]);
    const sheet = duelModifiers(loadoutSheet, ["networked_aim"], null);
    expect(sheet.laserDamageBonus).toBe(1);
    expect(sheet.wingmanLaserBonus).toBe(1);
    expect(sheet.projectsAura).toBe(true);
  });

  it("does_not_count_the_quick_build_pilots_own_ability_twice", () => {
    const loadoutSheet = resolveLoadoutModifiers(
      "confed_falcon",
      "falcon_striker",
    );
    const sheet = duelModifiers(loadoutSheet, ["predator"], "falcon_striker");
    expect(sheet).toEqual(loadoutSheet);
  });

  it("stacks_with_the_quick_build_when_its_pilot_ability_differs", () => {
    const loadoutSheet = resolveLoadoutModifiers(
      "confed_falcon",
      "falcon_striker",
    );
    const sheet = duelModifiers(loadoutSheet, ["fearless"], "falcon_striker");
    expect(sheet.stressedLaserBonus).toBe(loadoutSheet.stressedLaserBonus + 1);
  });

  it("counts_a_repeated_ability_once", () => {
    const sheet = duelModifiers(
      NEUTRAL_MODIFIERS,
      ["fearless", "fearless"],
      null,
    );
    expect(sheet.stressedLaserBonus).toBe(1);
  });
});

describe("duelShotOdds", () => {
  it("uses_the_bare_dice_without_abilities", () => {
    const odds = duelShotOdds(duelShip(), duelShip());
    expect(odds.hitChance).toBe(BASE_HIT_CHANCE);
    expect(odds.extraDamageChance).toBe(0);
  });

  it("adds_an_attack_die_for_ad_hoc_outmaneuver", () => {
    const ace = duelShip({ abilities: ["outmaneuver"] });
    expect(duelShotOdds(ace, duelShip()).hitChance).toBe(
      expectedChance("outmaneuver", ONE_MORE_ATTACK_DIE),
    );
  });

  it("rounds_an_ad_hoc_lone_wolf_attack_reroll_up_to_one_die", () => {
    const ace = duelShip({ abilities: ["lone_wolf"] });
    expect(duelShotOdds(ace, duelShip()).hitChance).toBe(
      expectedChance("lone_wolf", ONE_MORE_ATTACK_DIE),
    );
  });

  it("gives_an_ad_hoc_lone_wolf_target_a_defense_die", () => {
    const target = duelShip({ abilities: ["lone_wolf"] });
    expect(duelShotOdds(duelShip(), target).hitChance).toBe(
      expectedChance("lone_wolf", ONE_MORE_DEFENSE_DIE),
    );
  });

  it("adds_ad_hoc_tenacity_attack_die_only_below_half_hull", () => {
    const healthy = duelShip({ abilities: ["tenacity"] });
    const wounded = duelShip({ abilities: ["tenacity"], hull: WOUNDED_HULL });
    expect(duelShotOdds(healthy, duelShip()).hitChance).toBe(BASE_HIT_CHANCE);
    expect(duelShotOdds(wounded, duelShip()).hitChance).toBe(
      expectedChance("tenacity", ONE_MORE_ATTACK_DIE),
    );
  });

  it("adds_ad_hoc_predatory_instinct_die_only_against_a_damaged_target", () => {
    const hunter = duelShip({ abilities: ["predatory_instinct"] });
    const scratched = duelShip({ hull: SCRATCHED_HULL });
    expect(duelShotOdds(hunter, duelShip()).hitChance).toBe(BASE_HIT_CHANCE);
    expect(duelShotOdds(hunter, scratched).hitChance).toBe(
      expectedChance("predatory_instinct", ONE_MORE_ATTACK_DIE),
    );
  });

  it("gives_stealth_device_a_defense_die_at_full_hull", () => {
    const stealthy = duelShip({ abilities: ["stealth_device"] });
    expect(duelShotOdds(duelShip(), stealthy).hitChance).toBe(
      ONE_MORE_DEFENSE_DIE,
    );
  });

  it("drops_the_stealth_device_die_once_the_hull_is_damaged", () => {
    const scratched = duelShip({
      abilities: ["stealth_device"],
      hull: SCRATCHED_HULL,
    });
    expect(duelShotOdds(duelShip(), scratched).hitChance).toBe(BASE_HIT_CHANCE);
  });

  it.each(DUEL_ABILITIES.filter(isSheetAbility))(
    "never_adds_dice_for_sheet_ability_%s",
    (id) => {
      const fullHull = duelShip({ abilities: [id] });
      const wounded = duelShip({ abilities: [id], hull: WOUNDED_HULL });
      expect(duelShotOdds(fullHull, fullHull).hitChance).toBe(BASE_HIT_CHANCE);
      expect(duelShotOdds(wounded, wounded).hitChance).toBe(BASE_HIT_CHANCE);
    },
  );

  it("gives_marksmanship_a_half_chance_of_extra_damage", () => {
    const ace = duelShip({ abilities: ["marksmanship"] });
    expect(duelShotOdds(ace, duelShip()).extraDamageChance).toBe(0.5);
  });
});

describe("marksmanshipDamage", () => {
  it("adds_damage_when_the_roll_falls_in_the_lucky_share_of_hits", () => {
    expect(marksmanshipDamage(0.1, 0.6, 0.5)).toBe(MARKSMANSHIP_EXTRA_DAMAGE);
  });

  it("adds_nothing_for_a_hit_outside_the_lucky_share", () => {
    expect(marksmanshipDamage(0.4, 0.6, 0.5)).toBe(0);
  });

  it("adds_nothing_without_marksmanship", () => {
    expect(marksmanshipDamage(0, 0.6, 0)).toBe(0);
  });

  it("caps_a_boosted_hit_chance_at_certainty", () => {
    expect(marksmanshipDamage(0.55, 1.2, 0.5)).toBe(0);
    expect(marksmanshipDamage(0.45, 1.2, 0.5)).toBe(MARKSMANSHIP_EXTRA_DAMAGE);
  });
});
