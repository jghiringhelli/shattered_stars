/**
 * Faction codex — the five factions as encyclopedia entries: identity,
 * signature aura, fleet make-up (counted from the ship and pilot data, never
 * authored) and their cheapest quick builds. Pure.
 */

import type { FactionId } from "../../config";
import { FACTION_AURA_TEXT } from "../factionAuraText";
import { PILOT_CARDS } from "../../systems/SquadBuilder";
import { SHIP_DEFINITIONS } from "../ShipDefinitions";
import { offeredQuickBuilds } from "../quickBuildIndex";
import { titleCase, withSearchText, type CodexEntry } from "./codexTypes";

/** What a faction is, in the player's words. */
interface FactionProfile {
  readonly name: string;
  readonly playstyle: string;
  readonly identity: string;
}

/** The factions in menu order, with their identity text. */
export const FACTION_PROFILES: Readonly<Record<FactionId, FactionProfile>> = {
  terran_hegemony: {
    name: "Terran Hegemony",
    playstyle: "Elite, expensive ships",
    identity:
      "A disciplined military power: tough, well-armed hulls flown in formation, where wingmen near an ace or support ship deal extra damage.",
  },
  free_confederation: {
    name: "Free Confederation",
    playstyle: "Balanced, versatile",
    identity:
      "A coalition of free worlds fielding adaptable fighters and rigger-crewed strike craft that cover each other: wingmen near a banner ship take a third less damage.",
  },
  synthetic_collective: {
    name: "Synthetic Collective",
    playstyle: "Swarm tactics, drones",
    identity:
      "A machine hive: cheap drones linked into a swarm that shrugs off fire the more of it flies together.",
  },
  void_corsairs: {
    name: "Void Corsairs",
    playstyle: "Fast raiders, hit-and-run",
    identity:
      "Pirates and smugglers on fast, hard-hitting raiders, running black-market gear that trades safety for punch.",
  },
  ascendant_empire: {
    name: "Ascendant Empire",
    playstyle: "Heavy shields, support",
    identity:
      "A theocratic empire of shielded psions whose powers mend and guide the ships around them.",
  },
};

/** Cheapest builds cited per faction. */
const CHEAPEST_BUILDS = 3;

/**
 * @param faction - A faction.
 * @returns "20 ships: 3 Light Fighter, 4 Heavy Fighter, …".
 */
function fleetLine(faction: FactionId): string {
  const ships = Object.values(SHIP_DEFINITIONS).filter(
    (ship) => ship.faction === faction,
  );
  const byRole = new Map<string, number>();
  for (const ship of ships) {
    byRole.set(ship.role, (byRole.get(ship.role) ?? 0) + 1);
  }
  const roles = [...byRole].map(([role, n]) => `${n} ${titleCase(role)}`);
  return `${ships.length} ships: ${roles.join(", ")}.`;
}

/**
 * @param faction - A faction.
 * @returns "N pilots, M named aces."
 */
function pilotLine(faction: FactionId): string {
  const pilots = Object.values(PILOT_CARDS).filter(
    (pilot) => pilot.faction === faction,
  );
  const aces = pilots.filter((pilot) => pilot.isUnique).length;
  return `${pilots.length} pilots, ${aces} named aces.`;
}

/**
 * @param faction - A faction.
 * @returns Its cheapest offered quick builds, as one line.
 */
function cheapestLine(faction: FactionId): string {
  return offeredQuickBuilds()
    .filter((build) => SHIP_DEFINITIONS[build.shipId]?.faction === faction)
    .sort((a, b) => a.pointCost - b.pointCost)
    .slice(0, CHEAPEST_BUILDS)
    .map((build) => `${build.name} (${build.pointCost} pts)`)
    .join(", ");
}

/**
 * Every faction as a codex entry.
 * @returns The faction entries, in menu order.
 */
export function factionCodexEntries(): CodexEntry[] {
  return (Object.keys(FACTION_PROFILES) as FactionId[]).map((faction) => {
    const profile = FACTION_PROFILES[faction];
    const text = FACTION_AURA_TEXT[faction];
    return withSearchText({
      section: "factions",
      id: faction,
      name: profile.name,
      tag: "FACTION",
      faction,
      subtitle: profile.playstyle,
      paragraphs: [
        { heading: "IDENTITY", text: profile.identity },
        { heading: "AURA", text: `${text.name}: ${text.short}` },
        { heading: "WHO IT COVERS", text: text.who },
        { heading: "RANGE", text: text.range },
        { heading: "EFFECT", text: text.effect },
        { heading: "WHEN IT STOPS", text: text.ends },
        { heading: "EXAMPLE", text: text.example },
        { heading: "FLEET", text: fleetLine(faction) },
        { heading: "PILOTS", text: pilotLine(faction) },
        { heading: "CHEAPEST BUILDS", text: cheapestLine(faction) },
      ],
    });
  });
}
