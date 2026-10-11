/**
 * quickBuildDetails — what a quick build really is, as the picker shows it:
 * the pilot (name, initiative, unique), the pilot's ability (card text plus
 * its real-time reading), the slot bar (ship slots plus the pilot's extra
 * slots, filled or empty) and each upgrade's real-time reading.
 *
 * Everything is read from the catalogues at call time (never cached), so a
 * rebalanced ship, pilot or card shows up as-is. Pure: no state, no Phaser.
 */

import type { UpgradeSlotType } from "../core/upgradeTypes";
import type { UpgradeDefinition, WeaponProfile } from "../core/upgradeTypes";
import { PILOT_ABILITIES } from "../systems/PilotAbilities";
import { PILOT_CARDS, type PilotCard } from "../systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../systems/UpgradeSystem";
import { PILOT_ABILITY_REALTIME } from "./pilotAbilityEffects";
import { summarizeRealtimeEffect } from "./realtimeEffectSummary";
import type { ShipLoadout } from "./ShipLoadouts";
import { slotBarFor } from "./ShipSlots";

/** One slot of a pilot's slot bar. */
export interface SlotBarEntry {
  readonly type: UpgradeSlotType;
  /** True when the pilot card adds this slot (not the ship). */
  readonly fromPilot: boolean;
}

/** One slot of a build's slot bar, with the card in it (if any). */
export interface FilledSlot extends SlotBarEntry {
  readonly upgradeId: string | null;
  readonly upgradeName: string | null;
}

/** The pilot flying a build. */
export interface PilotSummary {
  readonly id: string;
  readonly name: string;
  readonly initiative: number;
  readonly isUnique: boolean;
}

/** The pilot's signature ability. */
export interface AbilitySummary {
  readonly id: string;
  readonly name: string;
  /** The pilot card's own wording (X-Wing style). */
  readonly cardText: string;
  /** What it does in real-time combat, derived from its effect knobs. */
  readonly summary: string;
}

/** One upgrade card in a build. */
export interface UpgradeSummary {
  readonly id: string;
  readonly name: string;
  readonly slotType: UpgradeSlotType;
  readonly summary: string;
}

/** Everything the player needs to know about one quick build. */
export interface QuickBuildDetails {
  readonly loadoutId: string;
  readonly name: string;
  readonly shipId: string;
  readonly pointCost: number;
  readonly pilot: PilotSummary | null;
  readonly ability: AbilitySummary | null;
  readonly slots: readonly FilledSlot[];
  readonly upgrades: readonly UpgradeSummary[];
}

/** Separator between parts of an upgrade's summary. */
const PART_SEPARATOR = ", ";

/** Milliseconds per second, for reload times. */
const MS_PER_SECOND = 1000;

/** Stat bonuses every mode applies, and how each reads. */
const STAT_BONUS_LABELS = [
  ["hullBonus", "hull"],
  ["shieldBonus", "shields"],
  ["attackBonus", "attack"],
  ["agilityBonus", "agility"],
] as const;

/**
 * A pilot's slot bar: the ship's slots, then the pilot's extra slots, minus
 * the slots the pilot removes (first occurrence, as slotBarFor does).
 *
 * @param shipId - Ship definition id.
 * @param pilot - The pilot's slot changes; omit for the bare ship.
 * @returns Each slot, tagged with whether the pilot added it.
 */
export function pilotSlotBar(
  shipId: string,
  pilot?: Pick<PilotCard, "extraSlots" | "removedSlots">,
): SlotBarEntry[] {
  const bar: SlotBarEntry[] = [
    ...slotBarFor(shipId).map((type) => ({ type, fromPilot: false })),
    ...(pilot?.extraSlots ?? []).map((type) => ({ type, fromPilot: true })),
  ];
  for (const removed of pilot?.removedSlots ?? []) {
    const index = bar.findIndex((slot) => slot.type === removed);
    if (index !== -1) bar.splice(index, 1);
  }
  return bar;
}

/**
 * Put each upgrade into the first free slot of its category.
 *
 * @param bar - The slot bar.
 * @param upgradeIds - The build's cards, in order.
 * @returns The bar with each slot's card (unknown or homeless cards are skipped).
 */
export function fillSlotBar(
  bar: readonly SlotBarEntry[],
  upgradeIds: readonly string[],
): FilledSlot[] {
  const filled: FilledSlot[] = bar.map((slot) => ({
    ...slot,
    upgradeId: null,
    upgradeName: null,
  }));
  for (const upgradeId of upgradeIds) {
    const card = UPGRADE_DEFINITIONS[upgradeId];
    if (!card) continue;
    const index = filled.findIndex(
      (slot) => slot.upgradeId === null && slot.type === card.slotType,
    );
    if (index === -1) continue;
    filled[index] = {
      ...filled[index]!,
      upgradeId,
      upgradeName: card.name,
    };
  }
  return filled;
}

/**
 * A secondary weapon as one phrase: "3 dmg every 4s, homing".
 * @param weapon - The card's weapon profile.
 * @returns The weapon's reading.
 */
function summarizeWeapon(weapon: WeaponProfile): string {
  const seconds = Number((weapon.cooldownMs / MS_PER_SECOND).toFixed(1));
  const parts = [`${weapon.damage} dmg every ${seconds}s`];
  if (weapon.homingTurnRate) parts.push("homing");
  if (weapon.stressOnHit) {
    parts.push(`${Math.round(weapon.stressOnHit * 100)}% stress per hit`);
  }
  return parts.join(PART_SEPARATOR);
}

/**
 * What an upgrade card does in real time: its stat bonuses, its weapon (if
 * it is one) and its real-time effect knobs.
 *
 * @param card - The upgrade card.
 * @returns e.g. "+1 hull" or "+1 laser dmg vs unshielded targets" ("" if none).
 */
export function summarizeUpgrade(card: UpgradeDefinition): string {
  const parts: string[] = [];
  for (const [key, label] of STAT_BONUS_LABELS) {
    const bonus = card.effects?.[key];
    if (bonus) parts.push(`${bonus > 0 ? "+" : ""}${bonus} ${label}`);
  }
  if (card.weapon) parts.push(summarizeWeapon(card.weapon));
  const realtime = card.realtime ? summarizeRealtimeEffect(card.realtime) : "";
  if (realtime) parts.push(realtime);
  return parts.join(PART_SEPARATOR);
}

/**
 * A pilot ability's real-time reading.
 *
 * @param abilityId - PILOT_ABILITIES / PILOT_ABILITY_REALTIME key.
 * @returns e.g. "+1 laser dmg from behind the target" ("" when it has no effect).
 */
export function summarizePilotAbility(abilityId: string): string {
  const effect = PILOT_ABILITY_REALTIME[abilityId];
  return effect ? summarizeRealtimeEffect(effect) : "";
}

/**
 * The ability a pilot card names, described.
 * @param pilot - The pilot card.
 * @returns The ability, or null for a generic pilot.
 */
function describeAbility(pilot: PilotCard): AbilitySummary | null {
  if (!pilot.abilityId) return null;
  const ability = PILOT_ABILITIES[pilot.abilityId];
  return {
    id: pilot.abilityId,
    name: ability?.name ?? pilot.abilityId,
    cardText: pilot.abilityText ?? ability?.description ?? "",
    summary: summarizePilotAbility(pilot.abilityId),
  };
}

/**
 * Everything about one quick build: pilot, ability, filled slot bar and
 * upgrades, all read from the catalogues.
 *
 * @param loadout - The build.
 * @returns The build's details (pilot/ability null when unknown or generic).
 */
export function describeQuickBuild(loadout: ShipLoadout): QuickBuildDetails {
  const pilot = PILOT_CARDS[loadout.pilotId];
  const upgrades = loadout.upgrades.flatMap((id) => {
    const card = UPGRADE_DEFINITIONS[id];
    return card
      ? [
          {
            id,
            name: card.name,
            slotType: card.slotType,
            summary: summarizeUpgrade(card),
          },
        ]
      : [];
  });
  return {
    loadoutId: loadout.id,
    name: loadout.name,
    shipId: loadout.shipId,
    pointCost: loadout.pointCost,
    pilot: pilot
      ? {
          id: pilot.id,
          name: pilot.name,
          initiative: pilot.initiative,
          isUnique: pilot.isUnique,
        }
      : null,
    ability: pilot ? describeAbility(pilot) : null,
    slots: fillSlotBar(pilotSlotBar(loadout.shipId, pilot), loadout.upgrades),
    upgrades,
  };
}
