/**
 * duelRoundWeapons — a duel round's secondaries (missiles, torpedoes,
 * bombs, mines, turrets, cloaks) through the shared WeaponsDriver, armed
 * from each ship's quick build exactly as the Dogfight / Ace Duel scenes arm
 * theirs; the bots decide ordnance with OrdnanceDecision and every hit lands
 * through the round's damage path (duelRoundCombat.strike). Runs on the
 * round's flight clock, after the ROUND banner like the primaries.
 *
 * Mutates the round. Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, LOGIC_DELTA } from "../config";
import { decideOrdnance } from "../arcade/ai/OrdnanceDecision";
import { damageMitigationOf } from "../arcade/systems/DamageRules";
import { weaponBodyOf } from "../arcade/weapons/weaponBodies";
import { WeaponsDriver, type WeaponHit } from "../arcade/weapons/WeaponsDriver";
import { flightNow, living, strike, type RoundState } from "./duelRoundCombat";

/**
 * Arm every ship of the round and attach the driver to it.
 * @param state - The round (its `weapons` is set).
 * @returns The round's weapons driver.
 */
export function armRound(state: RoundState): WeaponsDriver {
  const driver = new WeaponsDriver(
    {
      bodies: () =>
        living(state.ships).map((ship) =>
          weaponBodyOf(
            ship,
            `side${ship.side}`,
            damageMitigationOf(ship.modifiers, false),
          ),
        ),
      wantedTargetOf: (id) => state.crew.targetOf(id),
      applyHit: (hit) => landOrdnance(state, hit),
    },
    {
      worldSize: BATTLEFIELD_SIZE,
      ledger: state.ledger,
      random: () => state.rng.next(),
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
 * One step of the secondaries: destroyed ships are disarmed, then the
 * runtime runs on the flight clock.
 * @param state - The round (armed by {@link armRound}).
 */
export function fireSecondaries(state: RoundState): void {
  const driver = state.weapons;
  if (!driver) return;
  for (const ship of state.ships) if (ship.hull <= 0) driver.forget(ship.id);
  driver.update(LOGIC_DELTA * state.tempo.flightScale, flightNow(state));
}

function landOrdnance(state: RoundState, hit: WeaponHit): void {
  const target = state.ships.find((s) => s.id === hit.targetId);
  if (!target || target.hull <= 0) return;
  const attacker = state.ships.find((s) => s.id === hit.attackerId) ?? target;
  state.ordnanceHits[attacker.side] += 1;
  strike(state, attacker, target, hit);
}
