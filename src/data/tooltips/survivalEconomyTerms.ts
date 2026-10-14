/**
 * SURVIVAL_ECONOMY_TERMS - tooltip terms of the Survival run economy and
 * setup screen: salvage and prices, rerolls, shop and dock options, events,
 * Star Charts unlocks, ascension, seed, daily challenge and the flagship
 * pick. Pure data; numbers match src/data/survival/economy.ts.
 */

import { term } from "./termTypes";

/** Terms of the Survival economy and setup. */
export const SURVIVAL_ECONOMY_TERMS = {
  "survival.salvage": term(
    "Salvage",
    "The run currency. You earn it from kills and cleared nodes and spend it in shops, events and at the dock.",
    "A run starts with 40 salvage. A regular kill pays 3, an elite 10, a boss 40; a cleared combat node pays 15.",
    "Salvage is per run: War Chest (a star chart unlock) is the only way to start with more.",
  ),
  "survival.price": term(
    "Price",
    "What an item costs in salvage. Greyed out when you cannot afford it; the reason is shown on the card.",
    "Repair 35, escort 75, upgrade 65, relic 60 / 90 / 130 by rarity (common / uncommon / rare).",
    "Relics like Black Market Codes cut every price by 20 %.",
  ),
  "survival.reroll": term(
    "Reroll",
    "A charge you spend to redraw an offer of powers or relics. A run starts with 1.",
    "You dislike all three powers: spend a reroll and see three new ones.",
    "Keep one for a draft where a capstone or cross power is close.",
  ),
  "survival.skip_draft": term(
    "Skip draft",
    "Decline all powers on offer and take salvage instead.",
    "Skipping a poor draft pays 12 salvage, which buys a third of a shop repair.",
  ),
  "survival.leave_shop": term(
    "Leave shop",
    "Undock and return to the sector map. Anything you did not buy is gone.",
    "Leave with 20 salvage left and it still counts toward the next shop.",
  ),
  "survival.shop_repair": term(
    "Shop repair",
    "Restores 30 % of the fleet's max hull for salvage. Hull does not recover on its own between battles.",
    "Your flagship is at 40 % hull before an elite node: one repair brings it to 70 %.",
  ),
  "survival.shop_relic": term(
    "Shop relic",
    "A permanent run-long passive. Two are stocked per shop; the price depends on rarity.",
    "Buy a relic that shares a tag with the ones you own to build toward a set bonus.",
    "Tags shown on the card tell you which of your relics it combos with.",
  ),
  "survival.shop_escort": term(
    "Shop escort",
    "Adds one AI escort ship to your fleet. Escorts fly with you and die for good when destroyed.",
    "A fifth escort adds firepower and feeds escort relics such as Pack Tactics.",
  ),
  "survival.shop_upgrade": term(
    "Ship upgrade",
    "A permanent upgrade level for one ship (max 3): +1 laser damage and extra hull per level.",
    "Two levels on the flagship: +2 laser damage and extra hull for the rest of the run.",
  ),
  "survival.dock_repair": term(
    "Repair dock",
    "A free stop: restores 45 % hull on every ship, or lets you upgrade one ship.",
    "Pick Repair Fleet after a hard elite fight; pick an upgrade when hulls are healthy.",
  ),
  "survival.event_choice": term(
    "Event choice",
    "A story event with options. Some cost salvage, some are gambles, some need a faction or fleet condition.",
    "A choice marked 60 % wins its reward six times in ten and costs you otherwise.",
    "Read the cost and the odds on the card before you click.",
  ),
  "survival.event_gamble": term(
    "Gamble odds",
    "The chance that this choice succeeds. On failure you take its listed penalty instead.",
    "70 % means seven wins in ten: worth it when the downside is small.",
  ),
  "survival.event_locked": term(
    "Locked option",
    "Greyed out: you cannot afford it or do not meet its condition (faction, escorts, a relic tag, rerolls).",
    "A blue option needs a specific faction; another faction's run sees it locked.",
  ),
  "survival.star_charts": term(
    "Star Charts",
    "The meta currency: earned at the end of every run, win or lose, and spent on permanent unlocks.",
    "Heavy Flagships costs 30 star charts; War Chest costs 35 for +30 starting salvage.",
    "Unlocks make every later run stronger: spend them before your next launch.",
  ),
  "survival.unlock_state": term(
    "Unlock status",
    "Owned: already yours. Locked: needs an earlier unlock first. A cost in star charts means you can buy it.",
    "Twin Wing Package needs Wingmate Package first.",
  ),
  "survival.ascension": term(
    "Ascension",
    "A difficulty ladder. Each level adds a visible modifier to the run; you unlock the next one by winning.",
    "Ascension 5 (Hardened Hulls): enemies have +15 % hull.",
    "Pick 0 to learn the run; climb once you win.",
  ),
  "survival.seed": term(
    "Seed",
    "The code that fixes the sector map, offers and events. The same seed gives the same run map.",
    "Type ROGUE1 to replay a map a friend shared; leave it on RANDOM for a fresh one.",
  ),
  "survival.daily": term(
    "Daily challenge",
    "Today's fixed-seed run, the same for everyone, with a local best and history.",
    "Run today's daily, then beat your own score tomorrow on a new seed.",
  ),
  "survival.history": term(
    "Run history",
    "Your last 20 runs: result, score and the seed to replay them.",
    "Open it to copy the seed of a run you want to try again.",
  ),
  "survival.flagship": term(
    "Flagship",
    "The ship you fly for the whole run. The escorts you gain fly with it, and its quick build sets your starting cards.",
    "Pick the interceptor for speed and Snap Turns, the heavy fighter for hull.",
    "Check the BUILDS tab: the quick build decides your starting pilot, cards and ability.",
  ),
  "survival.mode": term(
    "Survival",
    "A roguelite run through three sectors: plot a route on the map, fight, collect relics and powers, repair what you can. The Nexus flagship waits at the end.",
    "Fight a combat node, draft a power, buy a shield repair at the next shop, then face an elite.",
    "A lost fleet ends the run, but every run earns star charts for permanent unlocks.",
  ),
  "survival.launch": term(
    "Launch run",
    "Starts a new run on the sector map with the faction, flagship and build you picked.",
    "Terran Hegemony, the Viper, its default build: you begin with 40 salvage and 1 reroll.",
    "Three sectors, then the Nexus flagship. Plot your route on the map.",
  ),
  "survival.continue_run": term(
    "Continue run",
    "Resume your saved run exactly where you left it, on the sector map.",
    "Closed the game mid-sector? Continue puts you back at the same node.",
  ),
  "survival.abandon_run": term(
    "Abandon run",
    "Delete the saved run and start fresh. It is recorded as abandoned in your history.",
    "Abandon a run that is clearly lost to launch a new one with another flagship.",
  ),
} as const;
