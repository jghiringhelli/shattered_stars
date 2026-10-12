/**
 * Regenerating elite — a simulation-style spec that the Survival
 * "Regenerating" affix (2 shield HP/s) leaves an elite killable. Before the
 * regen units were fixed the repair step multiplied the affix by
 * DURABILITY_SCALE (24 HP/s), which out-healed a whole starter wing.
 *
 * Expected-value fight on the real rules: Survival combat stats, the elite
 * hull multiplier, both sides' default quick builds, the affix effect folded
 * on the elite's sheet, calculateHitChance odds moved by the shot levers (the
 * wing focuses the target its squad marked, from the side), the dice
 * attack's damage and mitigation (resolveDiceAttack), the X-Wing attack
 * tempo (attackIntervalMs) and the real repair step + damage-pause tracker.
 */

import { describe, it, expect } from "vitest";
import type { FactionId } from "../../../../src/config";
import { combineEffects } from "../../../../src/core/CombatModifiers";
import {
  calculateHitChance,
  getModeCombatStats,
} from "../../../../src/data/ModeBalancing";
import { getAffix } from "../../../../src/data/survival/affixes";
import {
  FACTION_STARTER_SHIPS,
  HEAVY_STARTERS,
} from "../../../../src/data/survival/starters";
import { attackIntervalMs } from "../../../../src/arcade/systems/CombatTempo";
import { eliteMaxHull } from "../../../../src/arcade/systems/SurvivalDurability";
import {
  assignQuickBuilds,
  equipQuickBuild,
} from "../../../../src/arcade/systems/QuickBuildEquip";
import {
  absorbDamage,
  resolveDiceAttack,
} from "../../../../src/arcade/systems/DiceAttack";
import { leverShot, shotPosition } from "../../../../src/arcade/ShotLevers";
import type { AbilityCombatant } from "../../../../src/arcade/PilotAbilityCombat";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import { DURABILITY_SCALE } from "../../../../src/config";
import type { CombatModifiers } from "../../../../src/core/CombatModifiers";
import {
  DamagePauseTracker,
  repairStep,
} from "../../../../src/arcade/systems/repair/HullRepair";

/** Simulation frame (ms). */
const FRAME_MS = 16;
/** The fight must be winnable within two minutes. */
const KILL_DEADLINE_MS = 120_000;
/** Starter fighters in the wing. */
const WING_SIZE = 2;
/** The wing fires from the elite's flank (neither rear arc nor head-on). */
const FLANK_OFFSET_PX = 200;

interface Elite {
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  readonly definitionId: string;
  combatStats: { attackDice: number; agilityDice: number };
}

function regeneratingElite(definitionId: string) {
  const stats = getModeCombatStats(definitionId, "survival");
  const ship: Elite = {
    hull: stats.hull,
    maxHull: stats.maxHull,
    shields: stats.shields,
    maxShields: stats.maxShields,
    definitionId,
    combatStats: {
      attackDice: stats.attackDice,
      agilityDice: stats.agilityDice,
    },
  };
  const sheet = equipQuickBuild(ship, assignQuickBuilds([definitionId])[0]!);
  ship.maxHull = eliteMaxHull(ship.maxHull);
  ship.hull = ship.maxHull;
  const affix = getAffix("regenerating")!.effect!;
  return { ship, modifiers: combineEffects([sheet, affix]) };
}

function combatant(
  id: string,
  pose: { x: number; y: number; angle: number },
  ship: { hull: number; maxHull: number; shields: number; maxShields: number },
  modifiers: CombatModifiers,
): AbilityCombatant {
  return {
    id,
    ...pose,
    ...ship,
    stress: INITIAL_STRESS,
    modifiers,
    frenzyUntilMs: 0,
  };
}

/** Expected damage of one starter's marked flank shot at the elite. */
function expectedShotDamage(
  starterId: string,
  elite: ReturnType<typeof regeneratingElite>,
): number {
  const stats = getModeCombatStats(starterId, "survival");
  const sheet = equipQuickBuild(
    { ...stats, definitionId: starterId },
    assignQuickBuilds([starterId])[0]!,
  );
  const attacker = combatant(
    "wing",
    { x: FLANK_OFFSET_PX, y: 0, angle: 0 },
    stats,
    sheet,
  );
  const target = combatant(
    "elite",
    { x: 0, y: 0, angle: 0 },
    elite.ship,
    elite.modifiers,
  );
  const hitChance = calculateHitChance(
    stats.attackDice,
    elite.ship.combatStats.agilityDice,
  );
  const shot = {
    attacker,
    target,
    hitChance,
    baseDamage: stats.attackDice,
    attackerHasWingman: true,
    targetHasWingman: false,
    nowMs: 0,
    roll: 0,
    targetMarked: true,
  };
  const levered = leverShot({
    hitChance,
    position: shotPosition(attacker, target),
    marked: true,
  });
  return levered.hitChance * resolveDiceAttack(shot).damage;
}

/**
 * @param starterId - The wing's hull.
 * @param eliteId - The elite's hull.
 * @param regenScale - Multiplier on the affix rate (1 = as authored; the
 *   old pipeline multiplied by DURABILITY_SCALE).
 * @returns Milliseconds until the elite dies, or Infinity past the deadline.
 */
function timeToKill(
  starterId: string,
  eliteId: string,
  regenScale = 1,
): number {
  const elite = regeneratingElite(eliteId);
  const { ship, modifiers } = elite;
  const volley =
    WING_SIZE * expectedShotDamage(starterId, regeneratingElite(eliteId));
  const interval = attackIntervalMs(
    getModeCombatStats(starterId, "survival").weaponCooldown,
  );
  const tracker = new DamagePauseTracker();
  let nextShotMs = 0;
  for (let now = 0; now <= KILL_DEADLINE_MS; now += FRAME_MS) {
    if (now >= nextShotMs) {
      Object.assign(ship, absorbDamage(ship, volley));
      nextShotMs += interval;
    }
    if (ship.hull <= 0) return now;
    const quiet = tracker.observe("elite", ship.hull, ship.shields, FRAME_MS);
    Object.assign(
      ship,
      repairStep({
        ...ship,
        shieldRegenPerSecond: modifiers.shieldRegenPerSecond * regenScale,
        hullRepairPerSecond: modifiers.hullRepairPerSecond * regenScale,
        deltaMs: FRAME_MS,
        msSinceDamage: quiet,
      }),
    );
  }
  return Infinity;
}

describe("Survival Regenerating elite", () => {
  const factions = Object.keys(FACTION_STARTER_SHIPS) as FactionId[];

  it("regenerates 2 shield HP per second (not x DURABILITY_SCALE)", () => {
    const { modifiers } = regeneratingElite(HEAVY_STARTERS.terran_hegemony);
    expect(modifiers.shieldRegenPerSecond).toBe(2);
  });

  it("was unkillable when the pipeline rescaled the affix by DURABILITY_SCALE", () => {
    expect(
      timeToKill(
        FACTION_STARTER_SHIPS.free_confederation,
        HEAVY_STARTERS.synthetic_collective,
        DURABILITY_SCALE,
      ),
    ).toBe(Infinity);
  });

  it.each(factions)(
    "a heavy-fighter elite of %s dies to 2 starter fighters of every faction within 120 s",
    (eliteFaction) => {
      const slow = factions
        .map((f) => ({
          starter: FACTION_STARTER_SHIPS[f],
          ms: timeToKill(
            FACTION_STARTER_SHIPS[f],
            HEAVY_STARTERS[eliteFaction],
          ),
        }))
        .filter(({ ms }) => ms > KILL_DEADLINE_MS);
      expect(slow).toEqual([]);
    },
  );
});
