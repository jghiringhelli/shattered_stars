import { describe, it, expect } from "vitest";
import {
  layoutWave,
  pointOnArc,
  reinforcementPoints,
  spawnRadius,
  SURVIVAL_BASE_BELT,
  type SpawnPoint,
} from "../../../../src/systems/survival/SurvivalSpawnArc";
import { planCombat } from "../../../../src/systems/survival/CombatNodePlan";
import { SurvivalBattleRules } from "../../../../src/systems/survival/SurvivalBattleRules";
import { SurvivalRunController } from "../../../../src/systems/survival/SurvivalRunController";
import { tightenBelt } from "../../../../src/systems/arena/ArenaBoundary";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import { MAX_ASCENSION } from "../../../../src/data/survival/ascension";
import { MAX_ENEMIES } from "../../../../src/data/survival/threat";
import { REGULAR_ROWS } from "../../../../src/data/survival/sectors";
import { RunBuilder, atActiveNode } from "./survivalRunBuilder";

const CENTER = { x: BATTLEFIELD_SIZE / 2, y: BATTLEFIELD_SIZE / 2 };

function distance(p: SpawnPoint): number {
  return Math.hypot(p.x - CENTER.x, p.y - CENTER.y);
}

/** Heading (deg) from a point straight at the arena centre. */
function headingToCenter(p: SpawnPoint): number {
  const deg = (Math.atan2(CENTER.y - p.y, CENTER.x - p.x) * 180) / Math.PI + 90;
  return ((deg % 360) + 360) % 360;
}

function expectInsideAndInward(
  points: readonly SpawnPoint[],
  safeRadius: number,
): void {
  for (const p of points) {
    expect(distance(p)).toBeLessThan(safeRadius);
    expect(distance(p)).toBeGreaterThan(0);
    const diff = Math.abs(((p.angle - headingToCenter(p) + 540) % 360) - 180);
    expect(diff).toBeLessThan(0.5);
  }
}

function allPoints(layout: ReturnType<typeof layoutWave>): SpawnPoint[] {
  return [
    ...layout.regulars,
    ...layout.elites,
    ...(layout.boss ? [layout.boss] : []),
  ];
}

describe("spawn arc geometry", () => {
  it("faces the centre from every bearing", () => {
    for (let bearing = -180; bearing <= 180; bearing += 15) {
      expectInsideAndInward([pointOnArc(CENTER, 1000, bearing)], 1001);
    }
    expect(pointOnArc(CENTER, 1000, 0)).toMatchObject({
      x: CENTER.x,
      y: CENTER.y - 1000,
      angle: 180,
    });
  });

  it("keeps the entry radius inside the safe zone at any squeeze", () => {
    for (const safe of [200, 400, 900, 1600, 2600]) {
      expect(spawnRadius(safe)).toBeLessThan(safe);
      expect(spawnRadius(safe)).toBeGreaterThan(0);
    }
  });

  it("places exactly the requested ships", () => {
    const layout = layoutWave({
      center: CENTER,
      safeRadius: 2600,
      regulars: 7,
      elites: 3,
      boss: true,
    });
    expect(layout.regulars).toHaveLength(7);
    expect(layout.elites).toHaveLength(3);
    expect(layout.boss).not.toBeNull();
  });
});

describe("every wave of every node, sector and ascension spawns inside the safe radius", () => {
  it("roguelite battle nodes (all sectors, rows, kinds, ascensions, waves, fleet sizes)", () => {
    let checked = 0;
    for (let ascension = 0; ascension <= MAX_ASCENSION; ascension++) {
      for (const kind of ["combat", "elite", "boss"] as const) {
        const base = atActiveNode(
          RunBuilder.aRun().withAscension(ascension).build(),
          kind,
        );
        for (let sector = 1; sector <= 3; sector++) {
          for (let row = 0; row <= REGULAR_ROWS; row++) {
            const nodeId = base.map.rows[row]![0]!.id;
            const run = { ...base, sector, activeNodeId: nodeId };
            const plan = planCombat(run)!;
            const rules = new SurvivalBattleRules(run, plan);
            for (let w = 0; w < plan.waves; w++) {
              const spec = rules.nextWave();
              const safeRadius = tightenBelt(
                SURVIVAL_BASE_BELT,
                spec.beltSteps,
              ).safeRadius;
              for (const ships of [1, 6]) {
                const controller = new SurvivalRunController(1);
                for (let l = 0; l < 40; l++) controller.beginWave();
                const size = controller.scaledWaveSize(
                  ships,
                  plan.threatMultiplier,
                  plan.extraElites,
                  plan.maxRegulars,
                  2,
                );
                const layout = layoutWave({
                  center: CENTER,
                  safeRadius,
                  regulars: size.enemyCount,
                  elites: size.eliteCount,
                  boss: spec.isBossWave,
                });
                expectInsideAndInward(allPoints(layout), safeRadius);
                if (layout.boss) {
                  expectInsideAndInward(
                    reinforcementPoints(
                      layout.boss,
                      4,
                      CENTER,
                      safeRadius,
                      160,
                    ),
                    safeRadius,
                  );
                }
                checked += 1;
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("endless waves (legacy direct starts) at every belt squeeze up to the floor", () => {
    for (let steps = 0; steps <= 30; steps++) {
      const safeRadius = tightenBelt(SURVIVAL_BASE_BELT, steps).safeRadius;
      const layout = layoutWave({
        center: CENTER,
        safeRadius,
        regulars: MAX_ENEMIES,
        elites: 5,
        boss: true,
      });
      expectInsideAndInward(allPoints(layout), safeRadius);
    }
  });
});
