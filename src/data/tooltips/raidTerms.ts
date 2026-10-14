/**
 * raidTerms — tooltip terms of the Boss Raid (capital assault) setup:
 * target, boss stats, sections, escorts, abilities and raid difficulty.
 * Pure data.
 */

import { term } from "./termTypes";

export const RAID_TERMS = {
  "ui.tab_abilities": term(
    "Abilities tab",
    "What the boss does during the fight and what each of its sections is for.",
    "Read that Broadside hits everything within 400 px, then plan strafing passes.",
    "Know the abilities before you fly in: the boss uses one every few seconds.",
  ),
  "raid.target": term(
    "Raid target",
    "The capital ship you must destroy. Each faction fields a boss with its own sections, shields and escorts.",
    "The Collective Mothership has ten escort drones: thin them out first, then break the core.",
    "Pick the boss that matches your strike wing: bombers like armoured sections, fast fighters like weak escorts.",
  ),
  "raid.boss_stats": term(
    "Hull, shields, armor",
    "Hull is the damage the boss takes before it dies. Shields soak damage first and regenerate. Armor is subtracted from every hit before shields and hull.",
    "Armor 3 turns a 4-damage laser into 1 damage, so use ordnance on the hull.",
    "Heavy guns and missiles cut through armor; lasers only chip it.",
  ),
  "raid.boss_sections": term(
    "Boss sections",
    "The boss hull is split into sections you can shoot separately. A section with weapons fires on you; a section with shields protects the boss.",
    "Destroy the Aft section of the Battlecruiser to silence its rear guns.",
    "Break the shield section first, then the guns, then the core.",
  ),
  "raid.escorts": term(
    "Escorts",
    "Fighters that fly with the boss and attack your wing. The boss can launch more during the fight.",
    "Six fighters guard the Hegemony Battlecruiser.",
    "Clear escorts first or they harass you while you strafe the hull.",
  ),
  "raid.boss_abilities": term(
    "Boss abilities",
    "Every few seconds the boss picks one: a broadside that hits every ship within 400 px, a fighter launch or a shield regeneration.",
    "Stay beyond 400 px when the broadside is charging.",
    "Hit-and-run passes beat parking next to the hull.",
  ),
  "raid.diff_easy": term(
    "Easy raid (0.75x)",
    "The boss has 75% of its normal hull and shields. A forgiving first assault.",
    "A 1440 hull Battlecruiser drops to about 1080.",
    "Use it to learn the sections and the boss abilities.",
  ),
  "raid.diff_medium": term(
    "Medium raid (1x)",
    "The boss at its published hull and shields. The intended difficulty.",
    "The Battlecruiser keeps its full 1440 hull.",
    "Pick it for a fair assault.",
  ),
  "raid.diff_hard": term(
    "Hard raid (1.5x)",
    "The boss has 150% of its normal hull and shields, so the fight lasts longer.",
    "The same Battlecruiser now has about 2160 hull.",
    "You need ordnance and focus fire on one section at a time.",
  ),
  "raid.diff_mythic": term(
    "Mythic raid (2x)",
    "The boss has double hull and shields. Only a coordinated wing with ordnance wins.",
    "About 2880 hull on the Battlecruiser.",
    "Break sections one by one and never linger inside broadside range.",
  ),
  "raid.begin": term(
    "Begin assault",
    "Launches the raid against the selected boss at the selected difficulty.",
    "Check the intel panel first: hull, shields, sections and escorts.",
  ),
  "raid.intel": term(
    "Target intel",
    "A summary of the selected boss at the selected difficulty: real-time hull and shields, sections and escort count.",
    "Hull 1440, Shields 320, Armor 3, sections Fore and Aft, 6 fighters.",
    "Change the difficulty and watch the numbers scale.",
  ),
} as const;
