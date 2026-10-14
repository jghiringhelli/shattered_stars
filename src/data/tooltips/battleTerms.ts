/**
 * battleTerms — tooltip terms for the Skirmish / Squad Builder setup:
 * battle type, reinforcement pool, teams, difficulty, scenarios, game modes,
 * and the five factions with their identity aura. Pure data.
 */

import type { FactionId } from "../../config";
import type { AIDifficultyLevel } from "../../ai/AIDifficulty";
import { FACTION_IDENTITIES } from "../factionIdentity";
import { term, type TermEntry } from "./termTypes";

/** Term id of a faction. */
export type FactionTermId = `faction.${FactionId}`;
/** Term id of an AI difficulty. */
export type DifficultyTermId = `diff.${AIDifficultyLevel}`;

const FACTION_EXAMPLES: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "Two aces plus wingmen inside the aura deal noticeably more damage.",
  free_confederation: "A crew-heavy bomber squad whose allies take 30% less damage nearby.",
  synthetic_collective: "A swarm of cheap drones that each make the others tougher.",
  void_corsairs: "A raider flies a red maneuver every cycle and stays stress-free.",
  ascendant_empire: "A shield-weaver keeps the wing healthy while a psion shoots.",
};

const FACTION_LABELS: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "Terran Hegemony",
  free_confederation: "Free Confederation",
  synthetic_collective: "Synthetic Collective",
  void_corsairs: "Void Corsairs",
  ascendant_empire: "Ascendant Empire",
};

export const FACTION_TERMS: Readonly<Record<FactionTermId, TermEntry>> =
  Object.fromEntries(
    (Object.keys(FACTION_IDENTITIES) as FactionId[]).map((id) => {
      const identity = FACTION_IDENTITIES[id];
      return [
        `faction.${id}`,
        term(
          FACTION_LABELS[id],
          `${identity.specialty}. ${identity.levers[0] ?? ""}`,
          FACTION_EXAMPLES[id],
          "Every faction's hulls are near-equal in points; its identity is the aura, signature cards and aces.",
        ),
      ];
    }),
  ) as Record<FactionTermId, TermEntry>;

export const DIFFICULTY_TERMS: Readonly<Record<DifficultyTermId, TermEntry>> = {
  "diff.easy": term(
    "Easy",
    "Novice AI pilots: slow reactions, sloppy flying and no focus-fire marks.",
    "An easy squad lets you practise a new build.",
  ),
  "diff.normal": term(
    "Normal",
    "Average AI pilots: steady pursuit and coordinated squads that mark one target.",
    "The default: a fair fight if you fly sensibly.",
  ),
  "diff.hard": term(
    "Hard",
    "Expert AI pilots plan their maneuvers ahead and punish mistakes.",
    "A hard enemy will flank you if you fly straight.",
  ),
  "diff.brutal": term(
    "Brutal",
    "Expert pilots with lightning reactions — the strongest opposition.",
    "Brutal is for squads that already win on hard.",
  ),
};

export const BATTLE_TERMS = {
  "battle.classic": term(
    "Classic battle",
    "One squad per side and no replacements: whoever loses their ships first loses.",
    "Your 200 pt squad against theirs — when your ships die, it is over.",
    "Every ship matters, so protect the expensive ones.",
  ),
  "battle.reinforcements": term(
    "Reinforcements",
    "Each team has a point pool to spend on replacements. When a ship dies you can field another from the pool.",
    "A 1000 pt pool lets you lose three ships and still win.",
    "Fight on: score depends on the pool running out or the destroyed points after 3 minutes.",
  ),
  "battle.reserve": term(
    "Reserve",
    "The queue of replacement ships a squad draws from when reinforcements are on.",
    "Put a bomber and two interceptors in reserve for later waves.",
    "Edit it before the fight; a picker offers replacements as ships fall.",
  ),
  "battle.pool": term(
    "Reinforcement pool",
    "The points a team can spend on deploying ships over the whole battle.",
    "POOL 1000 means about eight 125-point ships in total.",
  ),
  "battle.field_cap": term(
    "Field cap",
    "The most points a team may have on the battlefield at once.",
    "CAP 250 means you cannot send everything in together.",
  ),
  "battle.strategy": term(
    "Reserve strategy",
    "A preset that fills the reserve: balanced, swarm (many cheap), aces (named pilots) or heavy (bombers and gunships).",
    "Pick Swarm to flood the field with cheap fighters.",
  ),
  "battle.reset_reserve": term(
    "Reset to preset",
    "Refills the reserve with the selected strategy's default ships and throws away your edits.",
    "Swap three ships by hand, then press Reset to go back to the Swarm preset.",
  ),
  "team.chip": term(
    "Team chip (T1–T4)",
    "Assigns the squad to a team. Squads on the same team fight together; different teams are enemies.",
    "Put two squads on T1 and one on T2 for a 2v1 — or four teams for a free-for-all.",
    "The battle format (1v1, 2v2, FFA) is derived from how squads are assigned.",
  ),
  "mode.simple": term(
    "Simple flow",
    "Pick a faction, a ship and a payload — the battle starts when you launch.",
    "Fastest way to play Skirmish.",
  ),
  "mode.advanced": term(
    "Advanced builder",
    "Build full multi-ship squads, assign teams and tune the match settings.",
    "Make a 3-ship squad and set up a 2v2.",
  ),
  "mode.arcade": term(
    "Arcade",
    "Skirmish with a fixed fight: your squad against the opposing squad until one is gone.",
    "A 200 pt Arcade skirmish takes about five minutes.",
  ),
  "mode.continuous": term(
    "Continuous",
    "A continuous real-time tactical battle with a live battlefield and score.",
    "Fly until the objective is secured.",
  ),
  "mode.epic": term(
    "Epic format",
    "A big battle: 400 points per side and capital ships allowed.",
    "A flagship, escorts and fighters on both sides.",
  ),
  "ui.point_limit": term(
    "Point limit",
    "The most points a squad may spend. Higher limits mean bigger squads and longer fights.",
    "100 = a small duel, 200 = the standard skirmish, 300 = a large engagement.",
    "points",
  ),
  "ui.auto_fill": term(
    "Auto-fill",
    "Builds every empty squad for you up to the point limit.",
    "Press AUTO-FILL to quickly get an enemy squad.",
  ),
  "ui.randomize": term(
    "Randomize",
    "Replaces the squads with random legal builds.",
    "Use it to try an unfamiliar faction.",
  ),
  "ui.start_battle": term(
    "Start battle",
    "Launches the battle with the squads and settings on screen.",
    "Check team chips first: two squads on the same team do not fight each other.",
  ),
  "ui.mode_toggle": term(
    "Simple / Advanced",
    "Switches between the one-ship quick start and the full squad builder.",
    "Go Advanced for multi-ship squads.",
  ),
  "ui.controller": term(
    "Controller",
    "Who flies the squad: you (Player) or the AI.",
    "A Player squad takes your input; an AI squad flies at the chosen difficulty.",
  ),
  "ui.edit_ships": term(
    "Edit ships",
    "Opens the ship picker for this squad so you can add, remove or re-equip ships.",
    "Tap the card header.",
  ),
  "scenario.none": term(
    "Plain Skirmish",
    "No special objective — destroy the enemy.",
    "Classic shoot-out.",
  ),
  "scenario.satellite_array": term(
    "Satellite Array",
    "Three satellites: each round you score 1 point per satellite you control.",
    "Park a heavy fighter at a satellite, send an interceptor to contest another.",
    "Control needs more (or heavier) ships than the enemy near the satellite.",
  ),
  "scenario.chance_engagement": term(
    "Chance Engagement",
    "One central objective; scoring starts after the first quiet rounds.",
    "Both sides rush the centre in the third round.",
  ),
  "scenario.salvage_mission": term(
    "Salvage Mission",
    "Collect salvage from wrecks and bring it home to score.",
    "A fast ship grabs debris while the squad covers it.",
  ),
  "scenario.scramble_transmissions": term(
    "Scramble the Transmissions",
    "Hold a node long enough to scramble it; scrambled nodes score every round.",
    "Park two ships on a node for several cycles.",
  ),
} as const;
