/**
 * AuraShipFacts — the aura knobs of a ship's folded modifier sheet
 * (upgrades + pilot ability), as the optional AuraShip fields the aura
 * resolver reads. Every mode builds its AuraShips with these, so a pilot
 * ability's projection, radius, magnitude, stress relief and hit chance
 * reach allies everywhere — and an upgrade's radius bonus is read from the
 * sheet only (never again from the card list).
 *
 * Pure; the per-loadout lookup is memoised (auras resolve every frame).
 */

import type { CombatModifiers } from "../../core/CombatModifiers";
import { resolveLoadoutModifiers } from "../../arcade/ArcadeUpgradeEffects";
import type { AuraShip } from "./FactionAuras";

/** The aura part of a modifier sheet, spread into an AuraShip. */
export type AuraSheetFacts = Required<
  Pick<
    AuraShip,
    | "projectsAura"
    | "auraRadiusBonus"
    | "auraMagnitudeBonus"
    | "auraStressReliefTiers"
    | "auraHitChanceBonus"
  >
>;

/**
 * The aura knobs of a folded modifier sheet.
 *
 * @param modifiers - The ship's sheet (resolveLoadoutModifiers, or a mode's
 *   own folded sheet with relics / campaign abilities).
 * @returns The AuraShip fields to spread into the ship's snapshot.
 */
export function auraFactsOf(modifiers: CombatModifiers): AuraSheetFacts {
  return {
    projectsAura: modifiers.projectsAura,
    auraRadiusBonus: modifiers.auraRadiusBonus,
    auraMagnitudeBonus: modifiers.auraMagnitudeBonus,
    auraStressReliefTiers: modifiers.auraStressReliefTiers,
    auraHitChanceBonus: modifiers.auraHitChanceBonus,
  };
}

/** Memo of immutable catalogue facts per (hull, loadout). */
const factsByLoadout = new Map<string, AuraSheetFacts>();

/**
 * The aura knobs of a quick build (its upgrades plus its pilot's ability).
 *
 * @param definitionId - Ship definition id.
 * @param loadoutId - Its quick build, or null for the bare hull.
 * @returns The AuraShip fields to spread into the ship's snapshot.
 */
export function auraShipFacts(
  definitionId: string,
  loadoutId: string | null,
): AuraSheetFacts {
  const key = `${definitionId}|${loadoutId ?? ""}`;
  const cached = factsByLoadout.get(key);
  if (cached) return cached;
  const facts = auraFactsOf(resolveLoadoutModifiers(definitionId, loadoutId));
  factsByLoadout.set(key, facts);
  return facts;
}
