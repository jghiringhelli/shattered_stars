/**
 * nodeWeapons — a Survival node battle's secondaries (missiles, torpedoes,
 * bombs, mines, turrets, cloaks) through the shared WeaponsDriver, armed
 * from each ship's quick build as SurvivalScene arms them (wave ships when
 * they arrive); bots decide ordnance with OrdnanceDecision and each hit
 * lands through the node's damage path (relic multipliers, the tempo
 * ledger, kills, death blasts) like SurvivalScene.landHit.
 *
 * Mutates the battle. Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { decideOrdnance } from "../../arcade/ai/OrdnanceDecision";
import { applyInstantStress } from "../../arcade/ArcadeStress";
import { hasWingman } from "../../arcade/PilotAbilityCombat";
import { damageMitigationOf } from "../../arcade/systems/DamageRules";
import { weaponBodyOf } from "../../arcade/weapons/weaponBodies";
import {
  WeaponsDriver,
  type WeaponHit,
} from "../../arcade/weapons/WeaponsDriver";
import type { WeaponBody } from "../../arcade/weapons/weaponTypes";
import { dealDamage, resolveKill, type NodeCombat } from "./nodeCombat";
import type { NodeShip } from "./nodeShips";

/** A node battle's secondaries and what they did. */
export interface NodeWeapons {
  readonly driver: WeaponsDriver;
  /** Ships armed so far (wave ships are armed on arrival). */
  readonly armed: Set<string>;
  /** Ordnance and turret hits landed (every side). */
  hits: number;
}

/**
 * Arm the battle's secondaries and attach the driver to its combat.
 * @param combat - The node's combat (its `weapons` is set).
 * @param nowOf - The battle's clock (ms).
 * @returns The battle's secondaries.
 */
export function armNode(combat: NodeCombat, nowOf: () => number): NodeWeapons {
  const weapons: NodeWeapons = {
    driver: new WeaponsDriver(
      {
        bodies: () => livingBodies(combat),
        wantedTargetOf: (id) => wantedTargetOf(combat, id, nowOf()),
        applyHit: (hit, nowMs) => {
          if (landOrdnance(combat, hit, nowMs)) weapons.hits += 1;
        },
      },
      {
        worldSize: BATTLEFIELD_SIZE,
        ledger: combat.ledger,
        random: () => combat.rng.next(),
        decide: decideOrdnance,
      },
    ),
    armed: new Set(),
    hits: 0,
  };
  combat.weapons = weapons.driver;
  return weapons;
}

/**
 * One frame: arm new arrivals, disarm the destroyed, run the runtime.
 * @param weapons - The battle's secondaries.
 * @param combat - The node's combat.
 * @param nowMs - Battle time (ms).
 * @param deltaMs - Frame length (ms).
 */
export function fireNodeSecondaries(
  weapons: NodeWeapons,
  combat: NodeCombat,
  nowMs: number,
  deltaMs: number,
): void {
  for (const ship of combat.ships) {
    if (ship.hull <= 0) weapons.driver.forget(ship.id);
    else if (!weapons.armed.has(ship.id)) arm(weapons, ship);
  }
  weapons.driver.update(deltaMs, nowMs);
}

function arm(weapons: NodeWeapons, ship: NodeShip): void {
  weapons.armed.add(ship.id);
  weapons.driver.equip(ship.id, {
    definitionId: ship.definitionId,
    loadoutId: ship.loadoutId,
    modifiers: ship.modifiers,
  });
}

/** The pilot's wanted enemy: its bot's target, or the player's mark. */
function wantedTargetOf(
  combat: NodeCombat,
  shipId: string,
  nowMs: number,
): string | null {
  const ship = combat.ships.find((s) => s.id === shipId);
  if (!ship) return null;
  if (ship.bot) return ship.bot.targetId;
  return ship.owner === "player" ? combat.squadAi.playerMarkOf(nowMs) : null;
}

function livingBodies(combat: NodeCombat): WeaponBody[] {
  const living = combat.ships.filter((s) => s.hull > 0);
  return living.map((ship) =>
    weaponBodyOf(
      ship,
      ship.owner,
      damageMitigationOf(
        ship.modifiers,
        hasWingman(
          ship,
          living.filter((s) => s.owner === ship.owner),
        ),
      ),
    ),
  );
}

/** @returns True when the hit landed on a living ship. */
function landOrdnance(
  combat: NodeCombat,
  hit: WeaponHit,
  nowMs: number,
): boolean {
  const target = combat.ships.find((s) => s.id === hit.targetId);
  if (!target || target.hull <= 0) return false;
  const attacker = combat.ships.find((s) => s.id === hit.attackerId) ?? target;
  if (hit.stress > 0)
    target.flight = {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, hit.stress),
    };
  dealDamage(combat, target, hit.damage, nowMs);
  if (hit.damage > 0) combat.ledger.recordHit(attacker.id, target.id, nowMs);
  if (target.hull <= 0) resolveKill(combat, attacker, target, nowMs);
  return true;
}
