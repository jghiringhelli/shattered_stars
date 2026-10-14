/**
 * pickTerms — tooltip terms of the tabbed detail panels and the points bar
 * (tab names, budget, flown cost, aura tag, map option). Pure data.
 */

import { term } from "./termTypes";

/** Terms of the pick-screen chrome added with the tab system. */
export const PICK_TERMS = {
  "ui.tab_overview": term(
    "Overview tab",
    "The ship at a glance: art, role, points, a short description and its four key numbers.",
    "Hull 4, shields 2, attack 3, agility 2 — a sturdy all-rounder.",
    "Start here; open the other tabs only for the detail you want.",
  ),
  "ui.tab_stats": term(
    "Stats tab",
    "Every number of the ship, its maneuver dial (green, white and red moves) and its action bar.",
    "Green maneuvers are free; red ones add stress.",
    "Check the dial before you fly: a ship with few green moves tires fast.",
  ),
  "ui.tab_loadout": term(
    "Loadout tab",
    "The slots of the selected build, the card in each one and what every card costs.",
    "A torpedo card in the torpedo slot adds points but one big shot.",
    "The total at the bottom is the build's flown cost.",
    "points",
  ),
  "ui.tab_pilot": term(
    "Pilot tab",
    "The pilot who flies the build: initiative, unique or ace status, and the ability they bring.",
    "A unique ace with initiative 5 shoots before most rookies.",
    "A good pilot makes an average hull dangerous.",
  ),
  "ui.tab_builds": term(
    "Builds tab",
    "Every ready-made quick build of this hull, with what it is for, how to fly it, its strengths and weaknesses and a worked example.",
    "Pick the torpedo build to open fights, the escort build to guard bombers.",
    "Select a build here and it is the one that launches.",
  ),
  "ui.tab_effects": term(
    "Effects tab",
    "What the item does in battle, in plain language, with its numbers.",
    "Rapid fire: +20 % laser rate while not stressed.",
  ),
  "ui.tab_lore": term(
    "Lore tab",
    "The story of the ship, pilot or faction behind the numbers.",
    "Who built the hull and which war made it famous.",
  ),
  "ui.budget_bar": term(
    "Points budget",
    "Spent points against the limit, and what is left. Hull, pilot and every card count. A pick that goes over the limit is refused.",
    "130 spent of 200 leaves 70: room for a 45-point fighter.",
    "Keep a few points free for a second wave or a pilot upgrade.",
    "points",
  ),
  "ui.flown_cost": term(
    "Flown cost",
    "The real price of one ship as flown: its hull, its pilot's surcharge and every upgrade card.",
    "Hull 45 + pilot 8 + two cards (4 + 6) = flown cost 63.",
    "The budget bar always uses this figure, not the bare-hull price.",
    "points",
  ),
  "ui.aura_tag": term(
    "Faction aura",
    "A passive bonus every ship of the faction grants nearby allies of the same faction.",
    "Terran Hegemony: allies inside 380 px deal extra damage.",
    "Fly your squad close together to keep the aura on everyone.",
    "star",
  ),
  "ui.map_theme": term(
    "Map",
    "The backdrop of the battle: nebulae, asteroid fields, planets. Random picks a new one each battle. It changes looks only, not rules.",
    "Choose Prometheus Shadow for a dark nebula or Random to be surprised.",
    "Online battles ignore this choice so both players see the same sky.",
  ),
  "ui.filters": term(
    "Filters",
    "Narrow the ship list by role, faction or sort order. One filter is active at a time.",
    "Pick Bombers to see only ordnance ships.",
  ),
  "ui.tab_keys": term(
    "Switching tabs",
    "Click a tab, or press Q / E, the gamepad bumpers LB / RB, or left / right while the tab bar has focus.",
    "Press E to move from Overview to Stats.",
  ),
} as const;
