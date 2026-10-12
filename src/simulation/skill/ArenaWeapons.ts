/**
 * ArenaWeapons — the skill arena's ships carry their quick-build
 * secondaries (missiles, torpedoes, bombs, mines, turrets, cloaks) through
 * the shared WeaponsDriver, exactly as the battle scenes arm theirs: bots
 * decide ordnance with OrdnanceDecision, and every hit goes through the
 * arena's damage path (stress, shields then hull, the tempo ledger, kills
 * scored by BattleScore). Ordnance hits are tallied apart from the primary
 * hit rate; their damage counts toward the side's damage.
 *
 * Mutates the arena's ship records and tallies. Pure: no Phaser.
 */

import { decideOrdnance } from "../../arcade/ai/OrdnanceDecision";
import { applyInstantStress } from "../../arcade/ArcadeStress";
import { damageMitigationOf } from "../../arcade/systems/DamageRules";
import { absorbDamage } from "../../arcade/systems/DiceAttack";
import {
  WeaponsDriver,
  type WeaponHit,
} from "../../arcade/weapons/WeaponsDriver";
import { weaponBodyOf } from "../../arcade/weapons/weaponBodies";
import type { WeaponBody } from "../../arcade/weapons/weaponTypes";
import { destroyShip, type CombatState } from "./ArenaCombat";
import type { ArenaShip } from "./ArenaShip";
import { fliesWithWingman } from "./ArenaShotContext";

/**
 * Arm every ship of the battle and attach the driver to its combat state.
 * @param state - Combat state (its `weapons` is set).
 * @returns The battle's weapons driver.
 */
export function armArena(state: CombatState): WeaponsDriver {
  const driver = new WeaponsDriver(
    {
      bodies: () => livingBodies(state),
      wantedTargetOf: (id) =>
        state.ships.find((s) => s.id === id)?.pilot.targetId ?? null,
      applyHit: (hit, nowMs) => applyOrdnanceHit(state, hit, nowMs),
    },
    {
      worldSize: state.worldSize,
      ledger: state.ledger,
      random: state.random,
      decide: decideOrdnance,
    },
  );
  for (const ship of state.ships) {
    driver.equip(ship.id, {
      definitionId: ship.definitionId,
      loadoutId: ship.loadoutId,
      modifiers: ship.modifiers,
    });
  }
  state.weapons = driver;
  return driver;
}

/**
 * One tick of the secondaries: destroyed ships are disarmed, then the
 * runtime runs (its hits land through {@link applyOrdnanceHit}).
 * @param state - Combat state (armed by {@link armArena}).
 * @param nowMs - Arena time (ms).
 * @param deltaMs - Tick length (ms).
 */
export function resolveWeaponsTick(
  state: CombatState,
  nowMs: number,
  deltaMs: number,
): void {
  const driver = state.weapons;
  if (!driver) return;
  for (const ship of state.ships) if (!ship.alive) driver.forget(ship.id);
  driver.update(deltaMs, nowMs);
}

/**
 * A secondary hit: stress, shields then hull, the tempo ledger, the kill.
 * @param state - Combat state (mutated).
 * @param hit - The runtime's hit (final damage).
 * @param nowMs - Arena time (ms).
 */
export function applyOrdnanceHit(
  state: CombatState,
  hit: WeaponHit,
  nowMs: number,
): void {
  const target = state.ships.find((s) => s.id === hit.targetId);
  if (!target?.alive) return;
  const attacker = state.ships.find((s) => s.id === hit.attackerId) ?? target;
  target.flight = {
    ...target.flight,
    stress: applyInstantStress(target.flight.stress, hit.stress),
  };
  Object.assign(target, absorbDamage(target, hit.damage));
  state.ledger.recordHit(attacker.id, target.id, nowMs);
  const tally = state.tallies[attacker.side];
  tally.ordnanceHits += 1;
  tally.damage += hit.damage;
  if (target.hull <= 0) destroyShip(attacker, target, state, nowMs);
}

function livingBodies(state: CombatState): WeaponBody[] {
  return state.ships
    .filter((ship) => ship.alive)
    .map((ship) => bodyOf(ship, state));
}

function bodyOf(ship: ArenaShip, state: CombatState): WeaponBody {
  return weaponBodyOf(
    ship,
    ship.side,
    damageMitigationOf(ship.modifiers, fliesWithWingman(ship, state)),
  );
}
