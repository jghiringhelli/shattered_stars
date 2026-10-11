/**
 * SchoolCombat — Flight School's primary fire, composed from the shared
 * combat modules (DuelPrimaryFire target choice, DiceAttack resolution,
 * HitImmunityLedger tempo, squad-mark bonus via DuelBotCrew) exactly as
 * Dogfight composes them. Training drones are indestructible (they refill
 * on every hit) so the gunnery lesson cannot be failed; the final-exam bot
 * takes real damage.
 */

import { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../../arcade/systems/DiceAttack";
import type { DuelBotCrew } from "../../arcade/systems/DuelBotCrew";
import {
  primaryCooldownAfterShot,
  primaryShotTarget,
} from "../../arcade/systems/DuelPrimaryFire";
import { applyInstantStress } from "../../arcade/ArcadeStress";
import { calculateHitChance } from "../../data/ModeBalancing";
import { random } from "../../utils/random";
import type { SchoolShip } from "./schoolShips";

/** One resolved shot, for effects and lesson counters. */
export interface SchoolShot {
  readonly attacker: SchoolShip;
  readonly target: SchoolShip;
  readonly hit: boolean;
  readonly killed: boolean;
}

/** Ships that only fly (never shoot or get shot). */
function isTargetable(ship: SchoolShip): boolean {
  return ship.role !== "beacon" && ship.hull > 0;
}

/** Primary fire for every armed ship in the course. */
export class SchoolCombat {
  private readonly ledger = new HitImmunityLedger();

  /**
   * Fire every ready primary once (at most one attack per cycle each).
   *
   * @param ships - Every ship in the course.
   * @param crew - The squad layer (mark bonus, bot target preference).
   * @param frame - Frame length and scene time.
   * @returns The shots fired this frame.
   */
  fire(
    ships: readonly SchoolShip[],
    crew: DuelBotCrew | null,
    frame: { readonly deltaMs: number; readonly nowMs: number },
  ): SchoolShot[] {
    const shots: SchoolShot[] = [];
    const candidates = ships.filter(isTargetable);
    for (const gunner of candidates) {
      if (gunner.role === "drone") continue;
      gunner.weaponCooldown = Math.max(
        0,
        gunner.weaponCooldown - frame.deltaMs,
      );
      if (gunner.weaponCooldown > 0) continue;
      const target = primaryShotTarget({
        gunner,
        candidates,
        isEnemy: (other) => other.owner !== gunner.owner,
        ledger: this.ledger,
        nowMs: frame.nowMs,
        preferredId: crew?.targetOf(gunner.id) ?? null,
      });
      if (!target) continue;
      shots.push(this.shoot(gunner, target, crew, frame.nowMs));
      gunner.weaponCooldown = primaryCooldownAfterShot(gunner);
    }
    return shots;
  }

  /**
   * Forget a destroyed or removed ship.
   *
   * @param shipId - The ship.
   */
  forget(shipId: string): void {
    this.ledger.forget(shipId);
  }

  private shoot(
    attacker: SchoolShip,
    target: SchoolShip,
    crew: DuelBotCrew | null,
    nowMs: number,
  ): SchoolShot {
    const result = resolveDiceAttack({
      attacker: combatantOf(attacker),
      target: combatantOf(target),
      hitChance: calculateHitChance(
        attacker.combatStats.attackDice,
        target.combatStats.agilityDice,
      ),
      baseDamage: attacker.combatStats.attackDice,
      attackerHasWingman: false,
      targetHasWingman: false,
      nowMs,
      roll: random.next(),
      targetMarked: crew?.isMarkedShot(attacker.id, target.id, nowMs) ?? false,
    });
    if (!result.hit) return { attacker, target, hit: false, killed: false };
    this.ledger.recordHit(attacker.id, target.id, nowMs);
    target.flight = {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
    };
    if (target.role === "drone")
      return { attacker, target, hit: true, killed: false };
    const wasAlive = target.hull > 0;
    Object.assign(target, absorbDamage(target, result.damage));
    return {
      attacker,
      target,
      hit: true,
      killed: wasAlive && target.hull <= 0,
    };
  }
}
