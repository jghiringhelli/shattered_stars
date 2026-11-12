/**
 * BehaviourRun — flies one skill-arena battle (the same tick order as
 * runBattle) with a BehaviourProfiler watching, and returns each ship's
 * profile. The pilots are the tiers' real bots, wrapped only to count their
 * decisions.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { createSeededRng } from "../../utils/random";
import { botProfile } from "../../arcade/ai/BotDifficulty";
import { createBot } from "../../arcade/ai/bots/BotFactory";
import type { PilotBot, PilotIntent } from "../../arcade/ai/BotTypes";
import { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import { NO_SQUAD_MARKS } from "../../arcade/systems/SquadMark";
import { createSideScore } from "../../systems/arena/BattleScore";
import { auraOf, updateArenaAuras } from "./ArenaAuras";
import { emptyTally, resolveCombatTick } from "./ArenaCombat";
import type { CombatState } from "./ArenaCombatState";
import { ENGINE_RULES } from "./ArenaRules";
import {
  commandSquads,
  createSquads,
  eliminationWinner,
  flyShip,
  pilotShip,
  spawnShips,
} from "./ArenaRound";
import { contactOf } from "./ArenaShip";
import { TICK_MS, type BattleSpec, type SideSpec } from "./ArenaSpec";
import { armArena, resolveWeaponsTick } from "./ArenaWeapons";
import {
  emptyDecisions,
  type DecisionCounts,
  type ShipProfile,
} from "./BehaviourProfile";
import { BehaviourProfiler } from "./BehaviourProfiler";

/**
 * @param inner - The tier's real bot.
 * @param counts - Where to count its decisions.
 * @returns A bot that decides exactly like `inner` and counts what it asks for.
 */
function recordingBot(inner: PilotBot, counts: DecisionCounts): PilotBot {
  return {
    profile: inner.profile,
    decide(view, random): PilotIntent {
      const intent = inner.decide(view, random);
      counts.decisions++;
      if (intent.special) {
        counts.specialRequests++;
        if (view.self.isStressed) counts.specialRequestsWhileStressed++;
      }
      if (intent.boost) counts.boostRequests++;
      if (intent.barrelRoll) counts.rollRequests++;
      return intent;
    },
  };
}

/**
 * @param spec - A battle; entries fly their tier's bot unless they carry one.
 * @param counts - Receives each ship's decision counts, by ship id.
 * @returns The same battle with every pilot recorded.
 */
function recorded(
  spec: BattleSpec,
  counts: Map<string, DecisionCounts>,
): BattleSpec {
  const wrap = (side: "A" | "B"): SideSpec => ({
    ...spec[side],
    ships: spec[side].ships.map((entry, index) => {
      const own = emptyDecisions();
      counts.set(`${side}${index}`, own);
      const bot = entry.bot ?? createBot(entry.tier, botProfile(entry.tier));
      return { ...entry, bot: recordingBot(bot, own) };
    }),
  });
  return { ...spec, A: wrap("A"), B: wrap("B") };
}

/**
 * Fly a battle and profile every ship.
 * @param spec - Sides, seed and time limit (ms).
 * @returns One profile per ship, side A first.
 */
export function profileBattle(spec: BattleSpec): ShipProfile[] {
  const counts = new Map<string, DecisionCounts>();
  const watched = recorded(spec, counts);
  const random = createSeededRng(watched.seed).next;
  const ships = spawnShips(watched, random);
  const squads = createSquads(watched);
  const profiler = new BehaviourProfiler(BATTLEFIELD_SIZE, counts);
  for (const ship of ships) {
    const commit = ship.pilot.onCycleCommitted.bind(ship.pilot);
    ship.pilot.onCycleCommitted = (started) => {
      profiler.onCycle(ship, started);
      commit(started);
    };
  }
  const state: CombatState = {
    ships,
    ledger: new HitImmunityLedger(),
    rules: ENGINE_RULES,
    worldSize: BATTLEFIELD_SIZE,
    random,
    scores: { A: createSideScore(), B: createSideScore() },
    tallies: { A: emptyTally(), B: emptyTally() },
    recentHits: new Map(),
    marks: NO_SQUAD_MARKS,
  };
  armArena(state);
  const limit = watched.timeLimitMs ?? 120_000;
  for (let nowMs = 0; nowMs < limit;) {
    const contacts = ships.map(contactOf);
    commandSquads(squads, contacts, state, nowMs);
    for (const ship of ships)
      if (ship.alive) pilotShip(ship, contacts, squads, nowMs, TICK_MS);
    for (const ship of ships)
      if (ship.alive) flyShip(ship, undefined, auraOf(state, ship.id));
    nowMs += TICK_MS;
    updateArenaAuras(state, TICK_MS);
    resolveWeaponsTick(state, nowMs, TICK_MS);
    resolveCombatTick(state, nowMs, TICK_MS);
    profiler.tick(ships, nowMs, TICK_MS);
    if (eliminationWinner(ships, state)) break;
  }
  return profiler.results();
}
