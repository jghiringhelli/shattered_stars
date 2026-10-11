/**
 * raidHudSnapshot — pure builder for the Boss Raid's HUD contacts: every
 * living ship but the flagship (wingmen as allies, escorts as enemies) plus
 * the boss as a huge enemy contact. No Phaser.
 */

import type { ContactHudState } from "../../ui/hud/types";
import {
  contactHudState,
  ownerContacts,
  type ContactSource,
  type OwnedShipSource,
} from "../battleUi/hudSnapshot";

/** Contact id of the boss (also the flagship's target id when locked on it). */
export const BOSS_CONTACT_ID = "boss";

/** Inputs for the raid's contacts. */
export interface RaidContactsInput {
  /** The ship the HUD is centred on (left out of the contacts). */
  readonly flagshipId: string | null;
  readonly ships: Iterable<OwnedShipSource>;
  /** The boss, or null once it is gone. */
  readonly boss: ContactSource | null;
  /** Contact id the flagship has locked, or null. */
  readonly targetId: string | null;
}

/**
 * @param input - Flagship, ships, boss and the flagship's lock.
 * @returns HUD contacts for every living ship and the boss.
 */
export function raidContacts(input: RaidContactsInput): ContactHudState[] {
  const contacts = ownerContacts(input.flagshipId, input.ships, input.targetId);
  if (input.boss && input.boss.hull > 0) {
    contacts.push(
      contactHudState(
        { ...input.boss, id: BOSS_CONTACT_ID },
        "enemy",
        "huge",
        input.targetId === BOSS_CONTACT_ID,
      ),
    );
  }
  return contacts;
}
