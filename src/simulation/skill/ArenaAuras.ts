/**
 * ArenaAuras — the skill arena's ships repair and project faction auras
 * the way every battle scene does (simAuras: own regen / hull repair, then
 * each side's faction auras through the shared applyAllyAuraRepairs). The
 * shot / mitigation / stress buffs stay on the combat state for
 * ArenaCombat, ArenaWeapons and the flight tick.
 *
 * Mutates the arena's ship records. Pure: no Phaser.
 */

import type { ActiveAura } from "../../systems/SupportAura";
import { DamagePauseTracker, updateSimAuras } from "../simAuras";
import type { CombatState } from "./ArenaCombatState";

export { NO_AURAS } from "../simAuras";

/**
 * One frame of repair and auras for the living ships.
 * @param state - Combat state (its `auras` and `repairs` are set).
 * @param deltaMs - Frame length (ms).
 */
export function updateArenaAuras(state: CombatState, deltaMs: number): void {
  const tracker = (state.repairs ??= new DamagePauseTracker());
  state.auras = updateSimAuras(
    state.ships.filter((ship) => ship.alive),
    (ship) => ship.side,
    tracker,
    deltaMs,
  );
}

/**
 * @param state - Combat state.
 * @param shipId - A ship.
 * @returns The aura covering it this frame, if any.
 */
export function auraOf(
  state: CombatState,
  shipId: string,
): ActiveAura | undefined {
  return state.auras?.get(shipId);
}
