/**
 * duelTerms — tooltip terms of the Dogfight and Ace Duel setup screens:
 * the flown-points strip, ship / build choice, stat comparison, match format
 * and AI difficulty. Pure data.
 */

import { term } from "./termTypes";

export const DUEL_TERMS = {
  "ui.tab_match": term(
    "Match tab",
    "How the contest is set: the rounds and AI pilot of a duel, or the boss difficulty of a raid.",
    "Open MATCH, pick Best of 5 and Hard for a long, tough duel.",
    "The other tabs are about the ships or the boss; this one is about the rules.",
  ),
  "duel.points_you": term(
    "Your flown points",
    "The point cost of the ship and build you will fly: hull plus pilot plus cards.",
    "A 28 pt hull + an 8 pt pilot + a 6 pt card = 42 pt flown.",
    "Change the ship on OVERVIEW or the build on BUILDS and this number moves at once.",
    "points",
  ),
  "duel.points_enemy": term(
    "Enemy flown points",
    "The point cost of the enemy ship as it will fly. The AI always flies the default quick build of its hull.",
    "An enemy Raptor on its default build counts its hull, pilot and cards.",
    "If the enemy costs much more than you, expect to lose trades: lower the difficulty or fly a stronger build.",
    "points",
  ),
  "duel.points_gap": term(
    "Points gap",
    "How many flown points more (or fewer) you bring than the enemy. A big gap in either direction means an uneven duel.",
    "You 54 pt vs enemy 40 pt: you fly 14 pt more, so Hard is a fair test.",
    "Within about 10 points the duel is even; beyond that, skill and difficulty decide more than the ships.",
    "points",
  ),
  "duel.fight": term(
    "Fight!",
    "Starts the duel with the ships, builds and rules on screen. A short briefing runs first and can be skipped.",
    "Check the strip first: if you fly far fewer points than the enemy, expect a hard first round.",
  ),
  "duel.ship_row": term(
    "Ship choice",
    "The hull this side flies. Each faction lists four hulls; the points show the stock cost before any build.",
    "Hegemony lists the Viper interceptor, the Stiletto light fighter, the Raptor strike fighter and the Gladius heavy fighter.",
    "Hover a row for its role. The BUILDS tab lets you pick the pilot and cards of your own ship.",
  ),
  "duel.faction_pick": term(
    "Faction",
    "The faction decides which four hulls are listed. In a 1v1 duel only the hull and the build count, not the squad aura.",
    "Switch the enemy to Void Corsairs to fight a trick-flying raider instead of a disciplined Hegemony pilot.",
    "Use the arrows to cycle through the five factions.",
  ),
  "duel.stat_compare": term(
    "Stat comparison",
    "Your ship against the enemy, stat by stat. The better value of each pair is highlighted.",
    "Attack 3 vs 2 and Agility 2 vs 3: you hit harder, the enemy dodges better.",
    "Fly to your strengths: a high-attack ship wants straight passes, a high-agility ship wants to circle.",
  ),
  "duel.enemy_build": term(
    "Enemy build",
    "The AI flies the default quick build of its hull, so you always know what you face before the fight.",
    "An enemy flanker build wants to get behind you: turn tight and keep it in your front arc.",
    "You cannot change it, but you can read how it plays and counter it.",
  ),
  "duel.format_bo3": term(
    "Best of 3",
    "The first pilot to win two rounds wins the match. A round ends when one ship is destroyed.",
    "Win round 1, lose round 2, win round 3: you take the match 2-1.",
    "Short and sharp, about five minutes. One bad round does not end your match.",
  ),
  "duel.format_bo5": term(
    "Best of 5",
    "The first pilot to win three rounds wins the match, which rewards consistency over one lucky pass.",
    "A 3-2 comeback after losing the first two rounds.",
    "Takes about eight minutes. Pick it to practise a build over several rounds.",
  ),
  "duel.diff_easy": term(
    "Easy AI",
    "A slow, average pilot: it reacts about 2.2 times slower than the baseline and rarely lines up a clean shot.",
    "On Easy you can try a Hook Loop without being punished.",
    "Use it to learn a hull or a build.",
  ),
  "duel.diff_normal": term(
    "Normal AI",
    "An average pilot with steady pursuit and sensible turns. It flies with the same controls you do.",
    "The default: a fair fight if you fly sensibly.",
    "Pick it when the strip shows even points.",
  ),
  "duel.diff_hard": term(
    "Hard AI",
    "An expert pilot: it plans its maneuver one cycle ahead, flanks a straight-flying target and punishes mistakes (reaction x1.55 of the expert baseline).",
    "Fly straight for two cycles and a Hard pilot is already behind you.",
    "Pick it once you win on Normal.",
  ),
  "duel.diff_brutal": term(
    "Brutal AI",
    "An expert pilot with the fastest reactions (x0.85 of the expert baseline). The strongest opposition in the game.",
    "A Brutal pilot answers your Snap Turn with a turn of its own.",
    "For pilots who already win on Hard; expect to lose rounds while you learn it.",
  ),
  "duel.matchup": term(
    "Matchup",
    "A hand-made duel between two named aces with their own ships and abilities. Win to tick it off the list.",
    "Elite Fighters: Admiral Kronos against Phoenix Commander.",
    "You can fly either side; completed matchups keep their tick.",
  ),
  "duel.completed_count": term(
    "Completed counter",
    "How many of the preset matchups you have won at least once, on any difficulty.",
    "2/6 COMPLETED means two matchups are won; each shows a tick.",
  ),
  "duel.side_pick": term(
    "Your ace",
    "Choose which named ace you fly. The AI flies the other one.",
    "Pick Admiral Kronos to fly the marksman, or Phoenix Commander to hunt him.",
    "The points strip and the tabs follow your choice.",
  ),
  "duel.ace_ability": term(
    "Ace ability",
    "A talent that makes this pilot unique. It changes the real-time fight: a damage bonus, a defence or a free action.",
    "Lone Wolf rewards flying without a friend nearby.",
    "Hover an ability chip to read what it does.",
  ),
} as const;
