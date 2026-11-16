/**
 * SkillArena — headless, deterministic battles between AI pilots flying the
 * real engine exactly as the scenes fly them: each side's SquadCommand
 * (orders + squad mark), each ship's BotPilot (perception, decisions, hands
 * → PilotFlightControls, the human inputs), CycleFlight (template arcs,
 * cycle commits, stress), ArenaCombat (the dice modes' combat under the
 * CombatTempo round model). Fixed 60 Hz tick, one seeded RNG per battle,
 * elimination or timeout decided by BattleScore.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { createSeededRng } from "../../utils/random";
import { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import { NO_SQUAD_MARKS } from "../../arcade/systems/SquadMark";
import { createSideScore } from "../../systems/arena/BattleScore";
import { emptyTally, resolveCombatTick, type CombatState } from "./ArenaCombat";
import { ENGINE_RULES } from "./ArenaRules";
import { armArena, resolveWeaponsTick } from "./ArenaWeapons";
import { auraOf, updateArenaAuras } from "./ArenaAuras";
import { noteArenaFlight, updateArenaDisengage } from "./ArenaAce";
import {
  commandSquads,
  createSquads,
  eliminationWinner,
  flyShip,
  pilotShip,
  pointsWinner,
  resultOf,
  spawnShips,
} from "./ArenaRound";
import { contactOf, type ArenaShip } from "./ArenaShip";
import { immunityLedgerFor, resolveTempo } from "../TempoVariant";
import {
  DEFAULT_TIME_LIMIT_MS,
  TICK_MS,
  type BattleResult,
  type BattleSpec,
} from "./ArenaSpec";

export {
  DEFAULT_TIME_LIMIT_MS,
  TICK_MS,
  type BattleResult,
  type BattleSpec,
  type ShipEntry,
  type SideSpec,
  type SquadSetup,
} from "./ArenaSpec";

/**
 * Run one battle to elimination or the time limit.
 * @param spec - Sides, seed, time limit and rules.
 * @param onTick - Watches the ships after every tick (experiments: the movement lab's meters).
 * @returns Winner, duration, scores and gunnery tallies.
 */
export function runBattle(
  spec: BattleSpec,
  onTick?: (ships: readonly ArenaShip[], nowMs: number) => void,
): BattleResult {
  const random = createSeededRng(spec.seed).next;
  const ships = spawnShips(spec, random);
  const squads = createSquads(spec);
  const tempo = spec.tempo ? resolveTempo(spec.tempo) : undefined;
  const state: CombatState = {
    ships,
    ledger: tempo ? immunityLedgerFor(tempo) : new HitImmunityLedger(),
    rules: spec.rules ?? ENGINE_RULES,
    worldSize: BATTLEFIELD_SIZE,
    random,
    scores: { A: createSideScore(), B: createSideScore() },
    tallies: { A: emptyTally(), B: emptyTally() },
    recentHits: new Map(),
    marks: NO_SQUAD_MARKS,
    ...(tempo ? { tempo } : {}),
  };
  armArena(state);
  const limit = spec.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  // Flight, AI and combat run on the flight clock (k = 1 for the engine tempo).
  const k = tempo?.flightScale ?? 1;
  let nowMs = 0;
  while (nowMs < limit) {
    const contacts = ships.map(contactOf);
    commandSquads(squads, contacts, state, nowMs * k);
    for (const ship of ships) {
      if (!ship.alive) continue;
      const events = pilotShip(ship, contacts, squads, nowMs * k, TICK_MS * k);
      noteArenaFlight(state, ship, events, nowMs * k);
    }
    for (const ship of ships)
      if (ship.alive) flyShip(ship, tempo, auraOf(state, ship.id));
    nowMs += TICK_MS;
    updateArenaAuras(state, TICK_MS);
    updateArenaDisengage(state, nowMs * k);
    // Secondaries first, as in the scenes (a launch is the cycle's attack).
    resolveWeaponsTick(state, nowMs * k, TICK_MS * k);
    resolveCombatTick(state, nowMs * k, TICK_MS * k);
    onTick?.(ships, nowMs);
    const winner = eliminationWinner(ships, state);
    if (winner) return resultOf(spec.seed, winner, "elimination", nowMs, state);
  }
  return resultOf(spec.seed, pointsWinner(state), "timeout", nowMs, state);
}
