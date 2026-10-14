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
        "Coordinated Fire aura: allies inside 380 px deal +0.35 damage per hit",
        "Disciplined talents: Squadron Leader, Coordinated Assault",
        "Elite aces: Hold the Line (Kane, Whisper Null) adds +1 damage and takes 20% less beside a wingman, priced into the pilot",
      ],
      cards: ["squadron_leader", "coordinated_assault"],
      cardSlots: [],
      aceAbilities: true,
    },
    free_confederation: {
      faction: "free_confederation",
      specialty: "Crew, riggers and versatile ordnance",
      levers: [
        "Rallying Banner aura: allies take 30% less damage",
        "Rigger slots (Confederation-only: Repair / Targeting Rigger) and crew coordinators",
        "Torpedo and missile racks on its fighters",
      ],
      cards: [],
      cardSlots: ["astromech", "crew", "torpedo", "missile"],
      aceAbilities: false,
    },
    synthetic_collective: {
      faction: "synthetic_collective",
      specialty: "Cheap swarm and data-link coordination",
      levers: [
        "Hive Resilience aura: 8% less damage taken per drone nearby (up to 30%)",
        "Data-link cards: Swarm Uplink (Collective-only) and Pattern Analyzer relays",
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
        "Raider's Cadence aura: maneuvers one stress tier easier and +10% to hit inside 700 px",
        "Illicit slots (Corsair-only): Overcharged Capacitors, Hot-Wired Engines and other black-market gear",
        "Trick talents (Expert Handling, Daredevil, Phantom Strike) and raider aces",
      ],
      cards: ["expert_handling", "daredevil", "phantom_strike"],
      cardSlots: ["illicit"],
      aceAbilities: true,
    },
    ascendant_empire: {
      faction: "ascendant_empire",
      specialty: "Shields, support and psychic powers",
      levers: [
        "Aegis Field aura: allies regenerate 0.25 shield HP/s",
        "Psychic powers and talents (Ascendant-only): Foresight, Sensitive, Mending Light",
        "Support hulls (acolytes, prophets, oracles) projecting the field",
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
