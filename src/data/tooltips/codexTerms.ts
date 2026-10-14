/**
 * codexTerms — tooltip terms of the encyclopedia: sections, filters, search
 * and the ship detail's tabs (overview, stats, loadout, lore). Pure data.
 */

import { term } from "./termTypes";

export const CODEX_TERMS = {
  "codex.section_tabs": term(
    "Codex sections",
    "The books of the codex: ships, pilots, upgrades, factions and the bestiary. Switch with the tabs or the left and right arrows.",
    "Open PILOTS to read what each ace ability does in real time.",
  ),
  "codex.faction_filter": term(
    "Faction filter",
    "Shows only one faction's entries. ALL clears the filter, and it works together with the search text.",
    "Press CONF to list only Free Confederation ships.",
  ),
  "codex.search": term(
    "Search",
    "Type to filter the list by name. Backspace deletes a letter, Delete clears the field. While the field is empty Q and E switch the detail tabs.",
    "Type 'wasp' to find the Wasp Interceptor.",
  ),
  "codex.stats_scale": term(
    "Standard scale (1-5)",
    "Every combat stat is shown on the same 1 to 5 scale so ships compare at a glance. The exact numbers are in the ship picker.",
    "Speed 5/5 beats Speed 3/5, but a 3/5 hull with 5/5 defense lasts longer.",
  ),
  "codex.stat_speed": term(
    "Speed",
    "How far the ship travels in each 500 ms cycle. High speed closes gaps and escapes; low speed gives short, accurate turns.",
    "A 5/5 interceptor crosses the arena twice as fast as a 2/5 bomber.",
  ),
  "codex.stat_maneuver": term(
    "Maneuver",
    "How rich the maneuver dial is: banks, tight turns, Snap Turn, Hook Loop.",
    "5/5 maneuver means you can turn on a coin.",
  ),
  "codex.stat_attack": term(
    "Attack",
    "The primary weapon strength: how much damage a hit deals and how often it can fire.",
    "A 3/5 gun needs more passes than a 5/5 gun to kill the same hull.",
  ),
  "codex.stat_defense": term(
    "Defense",
    "Hull, shields and agility combined: how much punishment the ship absorbs.",
    "A 2/5 interceptor dies to a few hits; a 5/5 gunship shrugs them off.",
  ),
  "codex.stat_payload": term(
    "Payload",
    "How many ordnance and utility cards the hull carries. A bomber is high, a scout low.",
    "Payload 4/5 means torpedo, missile and bomb slots.",
  ),
  "codex.loadout_slots": term(
    "Slot bar",
    "The upgrade slots this hull offers. Each slot takes one card of its type.",
    "A Talent slot and a Missile slot let you fit one pilot talent and one missile.",
    "Hover a slot to read what its cards do.",
  ),
  "codex.signature_build": term(
    "Signature build",
    "The quick build that best shows the ship: its role line and who it flies best with.",
    "Interceptor flanker, best with a heavy fighter holding the line.",
  ),
  "codex.lore": term(
    "Lore",
    "The ship's history and the faction that fields it. Flavour only; it does not change stats.",
    "The Viper-class was built by the iron-disciplined Terran Hegemony to run down fleeing enemies.",
  ),
} as const;
