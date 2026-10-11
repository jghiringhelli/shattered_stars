/**
 * CampaignPilotEquip — campaign pilots fly quick builds like every other
 * mode, and fold in the real-time effects of every ability they have
 * unlocked as they level up. The protagonist flies the flagship; support
 * pilots fly the escorts in roster order.
 *
 * Pure: no Phaser.
 */

import {
  combineEffects,
  type CombatModifiers,
  type RealtimeEffect,
} from "../../core/CombatModifiers";
import type { CampaignPilot } from "../../data/PilotData";
import { PILOT_ABILITY_REALTIME } from "../../data/pilotAbilityEffects";
import { getShipLoadouts } from "../../data/ShipLoadouts";
import type { CampaignPilotState } from "../../systems/CampaignSaveManager";
import { PILOT_CARDS } from "../../systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";

/** First pilot level whose ability comes from the level track. */
const FIRST_LEVEL_UNLOCK = 2;

/** A campaign pilot flying in the squad. */
export interface SquadPilot {
  readonly state: CampaignPilotState;
  readonly definition: CampaignPilot;
}

/**
 * Which campaign pilot flies each ship of the squad: the protagonist the
 * flagship (seat 0), support pilots the escorts in roster order.
 *
 * @param pilots - The save's pilot states.
 * @param definitions - The faction's campaign pilot definitions.
 * @param squadSize - Ships in the player squad.
 * @returns One seat per ship: its pilot, or null when no pilot flies it.
 */
export function seatCampaignPilots(
  pilots: readonly CampaignPilotState[],
  definitions: readonly CampaignPilot[],
  squadSize: number,
): (SquadPilot | null)[] {
  const roster = [...definitions].sort(
    (a, b) =>
      Number(b.role === "protagonist") - Number(a.role === "protagonist"),
  );
  const seated = roster.flatMap((definition) => {
    const state = pilots.find((pilot) => pilot.pilotId === definition.id);
    return state ? [{ state, definition }] : [];
  });
  return Array.from({ length: squadSize }, (_, seat) => seated[seat] ?? null);
}

/**
 * Abilities a pilot flies with: its starting ones, those its level has
 * unlocked on the level track, and any granted otherwise (evolutions).
 *
 * @param pilot - The seated pilot.
 * @returns Ability ids, each once, in unlock order.
 */
export function campaignAbilityIds(pilot: SquadPilot): string[] {
  const { state, definition } = pilot;
  const byLevel: string[] = [];
  for (let level = FIRST_LEVEL_UNLOCK; level <= state.pilotSkill; level++) {
    const abilityId = definition.levelAbilityMap[level];
    if (abilityId) byLevel.push(abilityId);
  }
  return [
    ...new Set([
      ...definition.startingAbilityIds,
      ...byLevel,
      ...state.unlockedAbilityIds,
    ]),
  ];
}

/**
 * The real-time effects of a quick build: its upgrades, then its pilot
 * card's ability.
 *
 * @param definitionId - Ship definition id.
 * @param loadoutId - The quick build, or null for the bare hull.
 * @returns The effects and the pilot card's ability id (if any).
 */
function quickBuildEffects(
  definitionId: string,
  loadoutId: string | null,
): { effects: RealtimeEffect[]; cardAbilityId: string | undefined } {
  const loadout = getShipLoadouts(definitionId).find((l) => l.id === loadoutId);
  if (!loadout) return { effects: [], cardAbilityId: undefined };
  const cardAbilityId = PILOT_CARDS[loadout.pilotId]?.abilityId;
  const effects = loadout.upgrades
    .map((id) => UPGRADE_DEFINITIONS[id]?.realtime)
    .concat(cardAbilityId ? PILOT_ABILITY_REALTIME[cardAbilityId] : undefined)
    .filter((effect): effect is RealtimeEffect => effect !== undefined);
  return { effects, cardAbilityId };
}

/**
 * Modifier sheet of a quick build flown by a campaign pilot: the build's
 * upgrades and pilot-card ability plus the campaign pilot's abilities (an
 * ability the card already has counts once).
 *
 * @param definitionId - Ship definition id.
 * @param loadoutId - The quick build, or null for the bare hull.
 * @param abilityIds - The campaign pilot's abilities.
 * @returns The combined modifier sheet.
 */
export function campaignPilotModifiers(
  definitionId: string,
  loadoutId: string | null,
  abilityIds: readonly string[],
): CombatModifiers {
  const { effects, cardAbilityId } = quickBuildEffects(definitionId, loadoutId);
  const abilityEffects = abilityIds
    .filter((id) => id !== cardAbilityId)
    .map((id) => PILOT_ABILITY_REALTIME[id])
    .filter((effect): effect is RealtimeEffect => effect !== undefined);
  return combineEffects([...effects, ...abilityEffects]);
}
