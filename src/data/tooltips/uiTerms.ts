/**
 * uiTerms — tooltip terms for ship / build tags and the picker's own
 * controls: pilots, abilities, slot bar, quick builds, filters, sorting and
 * the action buttons. Pure data.
 */

import { term } from "./termTypes";

export const UI_TERMS = {
  "tag.starter": term(
    "Starter pick",
    "The ship we suggest for a first flight: forgiving, cheap and unlocked from the start.",
    "The golden-outlined STARTER card is the safest hull to learn the controls on.",
    "New players can launch it with the stock payload and still enjoy the battle.",
    "star",
  ),
  "tag.unique": term(
    "Unique pilot",
    "A named pilot — only one of each may fly in a squad (shown with a star).",
    "You cannot field two copies of the same ace, so a squad rotates through different aces.",
    "Unique pilots have stronger abilities and higher initiative than anonymous ones.",
    "star",
  ),
  "tag.ace": term(
    "Ace",
    "A named, high-initiative pilot with a signature ability: the squad's star performer.",
    "'Poison Fang' ambushes from behind for extra damage.",
    "Aces win duels but cost more; protect them with wingmen.",
    "star",
  ),
  "tag.turret": term(
    "Turret",
    "This hull can aim weapons around itself instead of only forward.",
    "A gunship can shoot a pursuer behind it while still flying away.",
    "Add turret cards to cover blind angles; combine with Rotate Arc.",
  ),
  "tag.ordnance": term(
    "Ordnance",
    "This hull is built to carry missiles, torpedoes or bombs.",
    "A bomber's torpedo rack deals a big first strike from range 2-3.",
    "Ordnance needs target locks and recharges over time; bring escorts.",
  ),
  "tag.support": term(
    "Support",
    "This ship projects an aura or can coordinate its wing.",
    "An Ascendant support ship regenerates its wing's shields; a Hegemony one makes their shots hit harder.",
    "Fly it with the squad, not in front of it.",
  ),
  "ui.locked": term(
    "Locked ship",
    "This ship is not available yet: you unlock hulls by earning XP in battle.",
    "The reason on the card (for example '500 XP') tells you how much more you need.",
    "Toggle 'unlocked only' to hide hulls you cannot field yet.",
  ),
  "ui.unlocked_only": term(
    "Unlocked only",
    "Hide the ships you have not unlocked yet to make the list easier to read.",
    "A new profile sees only starter hulls with this on.",
  ),
  "ui.epic_only": term(
    "Epic format only",
    "Capital ships are huge flagships allowed only in the Epic battle format (400 pts, several squads).",
    "Switch to Epic from the main menu's Epic Battle option to field a cruiser.",
    "In Skirmish the squad is a handful of fighters, bombers and gunships.",
    "role_capital",
  ),
  "ui.role_section": term(
    "Role section",
    "Ships are grouped by role. Each header shows how many ships and quick builds you can pick in that role.",
    "'INTERCEPTORS · 4 SHIPS · 12 BUILDS' tells you what the role offers.",
    "Use the chips above to show only one role.",
  ),
  "ui.role_filter_all": term(
    "Show all roles",
    "Clears the role filter so every ship section is listed again.",
    "Press ALL after looking at only bombers.",
  ),
  "ui.sort_points": term(
    "Sort by points",
    "Orders ships inside each role section by their points cost. Press to cycle default, cheapest first, most expensive first.",
    "PTS ↑ shows a 26 pt light fighter before a 37 pt one.",
    "Handy when you are filling the last points of a squad.",
    "points",
  ),
  "ui.build": term(
    "Quick build (payload)",
    "A ready-made loadout for a ship: a pilot plus a set of upgrade cards, priced for you.",
    "'Viper Ace' = Commander Striker + Predator + Burst Missile.",
    "BASE is the stock ship with a rookie pilot; builds add a pilot ability and cards.",
  ),
  "ui.build_base": term(
    "Base ship",
    "The stock hull with a rookie pilot and no upgrades — the cheapest way to field it.",
    "A 36 pt base interceptor is the pure hull price with nothing added.",
    "Pick a build for abilities, cards and extra stats.",
  ),
  "ui.build_pager": term(
    "More builds",
    "This ship has more quick builds than fit on one row. Press to see the next page.",
    "A popular hull may offer a dozen builds across four pages.",
  ),
  "ui.pilot": term(
    "Pilot",
    "The person flying the ship. Pilots have an initiative level, and named ones have a signature ability.",
    "Poison Fang (initiative 5) flies the Fang Raider build.",
    "Their initiative adds to the price; their ability changes how the ship fights.",
    "star",
  ),
  "ui.ability": term(
    "Pilot ability",
    "A special effect that belongs to the pilot, not the ship: more damage from behind, faster recharge, a free defensive trick.",
    "Ambush: +1 laser damage when shooting from behind the target.",
    "Fly the ship so the ability is always on: ambush needs a flank, not a head-on joust.",
  ),
  "ui.action_bar": term(
    "Action bar",
    "The actions this ship can take. Each action is a short dash or a token — Focus, Evade, Boost, Barrel Roll…",
    "A heavy fighter's bar of Focus and Target Lock suits steady shooting; an interceptor's Boost and Barrel Roll suit dodging.",
    "Actions are refused while the pilot is stressed; card effects can add more.",
  ),
  "ui.slot_bar": term(
    "Slot bar",
    "The row of upgrade slots the ship (plus its pilot) offers. A filled chip has a card in it; an empty one is free to use.",
    "MSL = missile, TRP = torpedo, CRW = crew, RIG = rigger, ILL = illicit, PSI = psychic power.",
    "Empty slots are room to customise the build or save points.",
  ),
  "ui.slot_pilot_edge": term(
    "Pilot-granted slot",
    "A gold edge means this slot is added by the pilot, not by the ship.",
    "A pilot who adds a talent slot makes any hull a little more flexible.",
  ),
  "ui.upgrade_card": term(
    "Upgrade card",
    "A card in a slot: stat bonuses, a weapon, or an effect that changes how the ship fights. Each card adds points.",
    "Hull Upgrade: +1 hull for 4 points.",
    "Read the real-time summary — it says exactly what the card does.",
  ),
  "ui.cost_breakdown": term(
    "Cost breakdown",
    "Where the points of a build go: the bare hull, the pilot's surcharge and each card.",
    "Hull 43 + pilot 5 + two cards (4 + 6) = 58 points.",
    "Compare builds of the same hull to see what each point actually buys.",
    "points",
  ),
  "ui.tab_build": term(
    "Build tab",
    "Shows the build's pilot, ability, slots and cards.",
    "See which slots are filled and which are still empty.",
  ),
  "ui.tab_guide": term(
    "How to fly tab",
    "A plain-language guide to the build: when to pick it, a concrete example and how to fly the pilot and each card.",
    "Read it before you launch an unfamiliar build.",
  ),
  "ui.tab_pros_cons": term(
    "Pros and cons tab",
    "What the build is good and bad at (from its real stats, pilot and cards), who it pairs with and what beats it.",
    "A fragile interceptor lists its low hull; a bomber lists limited ordnance.",
  ),
  "ui.tab_cost": term(
    "Cost tab",
    "A line-by-line price: hull, pilot and every card.",
    "Use it to find where to trim 2 points.",
    "points",
  ),
  "ui.add": term(
    "Add to squad",
    "Adds the selected ship and payload to your squad. The roster on the right updates.",
    "Add two copies of a ship with different builds to mix roles.",
  ),
  "ui.launch": term(
    "Launch",
    "Starts the battle with the selected faction, ship and payload.",
    "Choose a ship, pick a build, press Launch.",
  ),
  "ui.done": term(
    "Done",
    "Closes the picker and returns the squad to the builder.",
    "Press ESC or DONE after adding your ships.",
  ),
  "ui.clear": term(
    "Clear squad",
    "Removes every ship from the squad so you can start over.",
    "Clear when you want to rebuild a squad from scratch.",
  ),
  "ui.roster_row": term(
    "Squad row",
    "One ship of your squad with its build and price. Hover for details; press × to remove it.",
    "Two rows of the same hull may carry different builds.",
  ),
  "ui.points_total": term(
    "Squad points",
    "Total points of the squad against the point limit. Over the limit turns red and the squad cannot launch.",
    "198 / 200 pts leaves room for a 2-pt card.",
    "points",
  ),
} as const;
