/**
 * nodeWaves — the waves of a headless Survival node battle, spawned the
 * way SurvivalScene.startNextWave / spawnWaveEnemies / checkBossPhase do:
 * the belt squeezes, the wave is sized from the run's threat × the node's
 * multiplier (SurvivalRunController.scaledWaveSize), its roster planned
 * (planWaveRoster) and laid out on the spawn arc inside the safe radius; a
 * boss crossing a phase threshold restores its shields and calls in
 * reinforcements.
 *
 * Pure: no Phaser.
 */

import { planWaveRoster } from "../../arcade/systems/SurvivalLoadouts";
import { shouldStartNextBossPhase } from "../../systems/survival/CombatNodePlan";
import { nodeWaveRoster } from "../../systems/survival/NodeWaveRoster";
import { survivalBelt } from "../../systems/survival/SurvivalBelt";
import {
  layoutWave,
  reinforcementPoints,
} from "../../systems/survival/SurvivalSpawnArc";
import { livingPlayers } from "./nodeCombat";
import { ARENA_CENTER, createEnemy, type NodeShip } from "./nodeShips";
import type { NodeBattle } from "./nodeBattle";

/** Regulars that join a boss when it enters a new phase (scene constant). */
export const BOSS_PHASE_REINFORCEMENTS = 2;
/** Reinforcements enter this far (px) from the boss (scene constant). */
export const BOSS_REINFORCEMENT_OFFSET_PX = 160;

/**
 * Spawn the node's next wave.
 * @param battle - The battle (mutated).
 */
export function spawnWave(battle: NodeBattle): void {
  const { rules, controller, combat } = battle;
  const spec = rules.nextWave();
  controller.beginWave();
  battle.belt = survivalBelt(spec.beltSteps);
  combat.squadAi.resetEnemySquad();
  const slots = nodeWaveRoster({
    rules,
    controller,
    spec,
    playerShips: livingPlayers(combat).length,
  });
  const layout = layoutWave({
    center: ARENA_CENTER,
    safeRadius: battle.belt.safeRadius,
    regulars: slots.filter((s) => s.tier === "regular").length,
    elites: slots.filter((s) => s.tier === "elite").length,
    boss: slots.some((s) => s.tier === "boss"),
  });
  const next = { regular: 0, elite: 0 };
  for (const slot of slots) {
    const at =
      slot.tier === "boss"
        ? layout.boss
        : slot.tier === "elite"
          ? layout.elites[next.elite++]
          : layout.regulars[next.regular++];
    if (!at) continue;
    const ship = createEnemy(
      { slot, spec, faction: spec.faction, at, serial: battle.enemiesSpawned },
      rules,
      combat.squadAi,
    );
    addEnemy(battle, ship);
    if (slot.tier === "boss") battle.bossPhases.set(ship.id, 1);
  }
}

function addEnemy(battle: NodeBattle, ship: NodeShip): void {
  battle.combat.ships.push(ship);
  battle.enemiesSpawned += 1;
}

/**
 * A boss crossing a phase threshold restores its shields and calls in
 * reinforcements (scene's checkBossPhase).
 * @param battle - The battle (mutated).
 * @param boss - The boss just hit.
 */
export function spawnBossReinforcements(
  battle: NodeBattle,
  boss: NodeShip,
): void {
  const started = battle.bossPhases.get(boss.id);
  if (started === undefined || boss.hull <= 0) return;
  const { rules, combat } = battle;
  if (
    !shouldStartNextBossPhase(
      rules.plan.bossPhases,
      started,
      boss.hull / boss.maxHull,
    )
  )
    return;
  battle.bossPhases.set(boss.id, started + 1);
  boss.shields = boss.maxShields;
  const spec = { ...rules.currentWave(), isBossWave: false };
  const [slot] = planWaveRoster(rules.roster(spec.faction), {
    enemyCount: BOSS_PHASE_REINFORCEMENTS,
    eliteCount: 0,
    isMilestone: false,
  });
  if (!slot) return;
  const points = reinforcementPoints(
    boss,
    BOSS_PHASE_REINFORCEMENTS,
    ARENA_CENTER,
    battle.belt.safeRadius,
    BOSS_REINFORCEMENT_OFFSET_PX,
  );
  for (const at of points) {
    const ship = createEnemy(
      { slot, spec, faction: spec.faction, at, serial: battle.enemiesSpawned },
      rules,
      combat.squadAi,
    );
    addEnemy(battle, ship);
  }
}
