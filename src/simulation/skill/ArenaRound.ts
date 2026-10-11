/**
 * ArenaRound — the per-tick steps of a skill-arena battle, done the way a
 * scene does them: every side's SquadCommand updates its orders and mark,
 * every ship's BotPilot flies one frame through the player's controls, the
 * cycle engine advances each ship, and the battle ends by elimination or
 * the points tiebreak.
 *
 * Mutates the arena's ship records. Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../config";
import { BotPilot } from "../../arcade/ai/BotPilot";
import type { BotContact } from "../../arcade/ai/BotView";
import { SquadCommand } from "../../arcade/ai/SquadCommand";
import { tickCycleFlight } from "../../arcade/systems/CycleFlight";
import {
  regenerateShields,
  stressModifiersOf,
} from "../../arcade/systems/QuickBuildEquip";
import { resolveByPoints } from "../../systems/arena/BattleScore";
import type { CombatState, SideId } from "./ArenaCombatState";
import { spawnLayout } from "./ArenaLayout";
import { setArenaFlight, spawnArenaShip, type ArenaShip } from "./ArenaShip";
import { countSpecialActions } from "../../telemetry/matchStatTypes";
import {
  resolveTempo,
  scaleControlCooldowns,
  type ResolvedTempo,
} from "../TempoVariant";
import {
  SIDES,
  TICK_MS,
  type BattleResult,
  type BattleSpec,
} from "./ArenaSpec";

/**
 * @param spec - The battle.
 * @param random - The battle's seeded source (pilots draw from it too).
 * @returns Every ship spawned, side A first, each with its BotPilot.
 */
export function spawnShips(
  spec: BattleSpec,
  random: () => number,
): ArenaShip[] {
  const layout = spawnLayout(
    spec.A.ships.length,
    spec.B.ships.length,
    BATTLEFIELD_SIZE,
    random,
  );
  const tempo = spec.tempo ? resolveTempo(spec.tempo) : null;
  return SIDES.flatMap((side) =>
    spec[side].ships.map((entry, index) => {
      const reactionScale = tempo
        ? tempo.reactionScale(entry.reactionScale ?? 1)
        : entry.reactionScale;
      const ship = spawnArenaShip({
        id: `${side}${index}`,
        side,
        definitionId: entry.definitionId,
        pose: layout[side][index]!,
        pilot: new BotPilot(entry.tier, {
          random,
          ...(reactionScale !== undefined ? { reactionScale } : {}),
          ...(entry.bot ? { bot: entry.bot } : {}),
        }),
        ...(entry.loadoutId !== undefined
          ? { loadoutId: entry.loadoutId }
          : {}),
      });
      if (tempo) applyTempoToShip(ship, tempo);
      return ship;
    }),
  );
}

/**
 * Express a ship's real-ms action recharge on the tempo's flight clock.
 * @param ship - A freshly spawned ship (mutated).
 * @param tempo - The resolved tempo.
 */
export function applyTempoToShip(ship: ArenaShip, tempo: ResolvedTempo): void {
  const control = scaleControlCooldowns(ship.flight.motion.control, tempo);
  ship.flight = { ...ship.flight, motion: { ...ship.flight.motion, control } };
}

/**
 * @param spec - The battle.
 * @returns One SquadCommand (AI leader) per side that has a squad layer.
 */
export function createSquads(spec: BattleSpec): Map<SideId, SquadCommand> {
  const squads = new Map<SideId, SquadCommand>();
  for (const side of SIDES) {
    const setup = spec[side].squad;
    if (!setup) continue;
    squads.set(
      side,
      new SquadCommand({
        side,
        aiLeader: true,
        worldSize: BATTLEFIELD_SIZE,
        ...(setup.coordination ? { coordination: setup.coordination } : {}),
      }),
    );
  }
  return squads;
}

/**
 * Every squad layer updates its orders and its side's mark.
 * @param squads - Squad layer per side.
 * @param contacts - Every ship as the AI sees it.
 * @param state - Combat state (marks replaced).
 * @param nowMs - Arena time (ms).
 */
export function commandSquads(
  squads: ReadonlyMap<SideId, SquadCommand>,
  contacts: readonly BotContact[],
  state: CombatState,
  nowMs: number,
): void {
  for (const squad of squads.values()) {
    state.marks = squad.update({ nowMs, ships: contacts, marks: state.marks });
  }
}

/**
 * The ship's BotPilot flies one frame through the player's controls.
 * @param ship - The ship.
 * @param contacts - Every ship as the AI sees it (index-aligned with ships).
 * @param squads - Squad layer per side.
 * @param nowMs - Arena time (ms, flight clock).
 * @param deltaMs - Frame length on the flight clock (ms).
 */
export function pilotShip(
  ship: ArenaShip,
  contacts: readonly BotContact[],
  squads: ReadonlyMap<SideId, SquadCommand>,
  nowMs: number,
  deltaMs: number = TICK_MS,
): void {
  const self = contacts.find((c) => c.id === ship.id)!;
  const result = ship.pilot.fly({
    self,
    flight: ship.flight,
    dial: ship.dial,
    contacts: contacts.filter((c) => c.id !== ship.id),
    order: squads.get(ship.side)?.orderFor(ship.id) ?? null,
    nowMs,
    deltaMs,
    worldSize: BATTLEFIELD_SIZE,
  });
  ship.specialsUsed += countSpecialActions(result.events);
  setArenaFlight(ship, { motion: result.motion, stress: result.stress });
}

/**
 * Fly one tick on the cycle engine; tell the pilot when a cycle commits.
 * @param ship - The ship.
 * @param tempo - What-if tempo (flight clock); omitted = the engine's.
 */
export function flyShip(ship: ArenaShip, tempo?: ResolvedTempo): void {
  const tick = tickCycleFlight(ship.flight, {
    deltaMs: tempo ? TICK_MS * tempo.flightScale : TICK_MS,
    worldSize: BATTLEFIELD_SIZE,
    dial: ship.dial,
    cycleMs: tempo ? tempo.cycleMs : CYCLE_DURATION_MS,
    modifiers: stressModifiersOf(ship.modifiers),
  });
  setArenaFlight(ship, tick.state);
  ship.shields = regenerateShields(
    ship.shields,
    ship.maxShields,
    ship.modifiers,
    TICK_MS,
  );
  if (tick.completed) {
    ship.pilot.onCycleCommitted(
      tick.state.motion.control.currentManeuver ?? "straight",
    );
  }
}

/**
 * @param ships - All ships.
 * @param state - Combat state (scores break a mutual wipe-out).
 * @returns The side left standing, "draw" on a mutual wipe-out, or null.
 */
export function eliminationWinner(
  ships: readonly ArenaShip[],
  state: CombatState,
): SideId | "draw" | null {
  const aliveA = ships.some((s) => s.alive && s.side === "A");
  const aliveB = ships.some((s) => s.alive && s.side === "B");
  if (aliveA && aliveB) return null;
  if (aliveA) return "A";
  if (aliveB) return "B";
  return pointsWinner(state);
}

/**
 * @param state - Combat state.
 * @returns The side ahead on destroyed points (then kills), or "draw".
 */
export function pointsWinner(state: CombatState): SideId | "draw" {
  const outcome = resolveByPoints(state.scores.A, state.scores.B);
  return outcome === "side1" ? "A" : outcome === "side2" ? "B" : "draw";
}

/**
 * @param seed - The battle's seed.
 * @param winner - Who won.
 * @param endedBy - Elimination or timeout.
 * @param durationMs - Battle length (ms).
 * @param state - Final combat state.
 * @returns The battle's result record.
 */
export function resultOf(
  seed: number,
  winner: SideId | "draw",
  endedBy: BattleResult["endedBy"],
  durationMs: number,
  state: CombatState,
): BattleResult {
  const survivors = (side: SideId): number =>
    state.ships.filter((s) => s.alive && s.side === side).length;
  const flightScale = state.tempo?.flightScale ?? 1;
  return {
    seed,
    winner,
    endedBy,
    durationMs,
    scores: state.scores,
    tallies: state.tallies,
    survivors: { A: survivors("A"), B: survivors("B") },
    firstKillMs:
      state.firstKillAtMs === undefined
        ? null
        : state.firstKillAtMs / flightScale,
    specialsUsed: state.ships.reduce((sum, s) => sum + s.specialsUsed, 0),
  };
}
