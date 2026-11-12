/**
 * factionIdentity — what each faction excels at and the levers that make it
 * so (spec: docs/specs/factions.md). Every faction fields an almost equal
 * roster per role; the identity is carried by levers, not ship counts:
 *
 * - its signature aura (src/systems/aura/FactionAuras.ts),
 * - identity cards: faction-exclusive cards and the slot types only (or
 *   mostly) its hulls carry,
 * - for the ace factions, the signature abilities of its named pilots.
 *
 * The balance harness ablates exactly these levers (src/simulation/
 * identityAblation.ts) to measure what the identity is worth to its
 * faction; tests/balance/FactionIdentity.test.ts gates the margin.
 *
 * Pure data.
 */

import type { FactionId } from "../config";
import type { UpgradeSlotType } from "../core/upgradeTypes";
import { FACTION_AURA_TEXT } from "./factionAuraText";

/**
 * @param faction - A faction.
 * @returns The lever line of its aura: "<Name> aura: <short form>" (the
 *   picker's aura tag splits it on " aura: ").
 */
function auraLever(faction: FactionId): string {
  const { name, short } = FACTION_AURA_TEXT[faction];
  return `${name} aura: ${short}`;
}

/** One faction's identity and the levers that carry it. */
export interface FactionIdentity {
  readonly faction: FactionId;
  /** What the faction excels at (one line, player-facing). */
  readonly specialty: string;
  /** The levers, as the codex and docs describe them. */
  readonly levers: readonly string[];
  /** Cards whose effect is the identity (exclusive or signature cards). */
  readonly cards: readonly string[];
  /** Slot types whose cards are the identity (illicit, rigger, psychic…). */
  readonly cardSlots: readonly UpgradeSlotType[];
  /** True when the named pilots' abilities are part of the identity. */
  readonly aceAbilities: boolean;
}

/** Every faction's identity, keyed by faction. */
export const FACTION_IDENTITIES: Readonly<Record<FactionId, FactionIdentity>> =
  {
    terran_hegemony: {
      faction: "terran_hegemony",
      specialty: "Squad discipline and elite aces",
      levers: [
        auraLever("terran_hegemony"),
        "Squadron Leader talent: every maneuver counts one stress tier easier. Coordinated Assault talent: its ship projects Coordinated Fire and the field is 25% wider",
        "Elite aces: Hold the Line (Kane, Whisper Null) gives +1 damage per shot and 20% less damage taken beside a wingman, priced into the pilot",
      ],
      cards: ["squadron_leader", "coordinated_assault"],
      cardSlots: [],
      aceAbilities: true,
    },
    free_confederation: {
      faction: "free_confederation",
      specialty: "Crew, riggers and versatile ordnance",
      levers: [
        auraLever("free_confederation"),
        "Rigger slots (Confederation-only): a Repair Rigger restores shields between passes, a Targeting Rigger speeds target locks; crew coordinators also project the Rallying Banner",
        "Torpedo and missile racks on its fighters: one big guided hit once a target lock is held",
      ],
      cards: [],
      cardSlots: ["astromech", "crew", "torpedo", "missile"],
      aceAbilities: false,
    },
    synthetic_collective: {
      faction: "synthetic_collective",
      specialty: "Cheap swarm and data-link coordination",
      levers: [
        auraLever("synthetic_collective"),
        "Data-link cards: Swarm Uplink (Collective-only) gives 5% less damage taken while a friendly ship is near; Pattern Analyzer gives +1 laser damage in the bullseye and stress builds 20% slower",
        "The cheapest hulls: four-ship squads at 200 points",
      ],
      cards: ["swarm_uplink", "pattern_analyzer"],
      cardSlots: [],
      aceAbilities: false,
    },
    void_corsairs: {
      faction: "void_corsairs",
      specialty: "Tricks and hit-and-run aces",
      levers: [
        auraLever("void_corsairs"),
        "Illicit slots (Corsair-only): black-market cards that trade a drawback for punch, e.g. Overcharged Capacitors (+1 laser damage, stress builds 25% faster) and Hot-Wired Engines (boost recharges 50% faster, stress builds 20% faster)",
        "Trick talents: Expert Handling (barrel roll recharges 25% faster), Daredevil (Snap Turn, Hook Loop and Knife Roll recharge 40% faster), Phantom Strike (+1 laser damage from behind); plus raider aces",
      ],
      cards: ["expert_handling", "daredevil", "phantom_strike"],
      cardSlots: ["illicit"],
      aceAbilities: true,
    },
    ascendant_empire: {
      faction: "ascendant_empire",
      specialty: "Shields, support and psychic powers",
      levers: [
        auraLever("ascendant_empire"),
        "Psychic powers and talents (Ascendant-only): Foresight (10% less damage taken), Psi-Sensitive (15% less damage taken), Precognition (stress builds 25% slower), Mending Light (its ship projects the Aegis Field plus 0.06 shield points per second more)",
        "Support hulls (acolytes, prophets, oracles) projecting the field: they also patch a little hull",
      ],
      cards: ["force_sensitive", "precognition"],
      cardSlots: ["force_power"],
      aceAbilities: false,
    },
  };

/**
 * @param identity - A faction's identity.
 * @param upgradeId - A card id.
 * @param slotType - The card's slot type (undefined = unknown card).
 * @returns Whether the card is one of the identity's levers.
 */
export function isIdentityCard(
  identity: FactionIdentity,
  upgradeId: string,
  slotType: UpgradeSlotType | undefined,
): boolean {
  if (identity.cards.includes(upgradeId)) return true;
  return slotType !== undefined && identity.cardSlots.includes(slotType);
}
