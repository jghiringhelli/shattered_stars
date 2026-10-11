/**
 * Survival roguelite — measured battle-node durations (ADR-0004).
 *
 * A bot (escort-tier BotPilot that marks its target like a player) flies
 * the flagship through whole battle nodes in real time; each test logs how
 * long the node took (scene clock) and how it ended. Assertions only bound
 * the duration so the spec catches stalemates and instant wins.
 *
 * Opt-in (minutes long, and any HMR reload of the shared dev server aborts
 * it): `SURVIVAL_MEASURE=1 npx playwright test survival-node-duration`.
 * The numbers in ADR-0004 were measured with these scenarios.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForMenuReady,
  waitForScene,
  suppressWebGLNoise,
} from "./helpers/game";

/** A node longer than this is treated as a stalemate (ms). */
const MAX_NODE_MS = 240_000;
/** A node shorter than this means the wave never fought (ms). */
const MIN_NODE_MS = 5_000;

interface NodeSetup {
  readonly label: string;
  readonly kind: "combat" | "elite";
  readonly sector: number;
  readonly row: number;
  /** Waves fought so far (threat level). */
  readonly level: number;
  /** Mid-run build: flat run bonuses and escorts. */
  readonly bonuses: Readonly<Record<string, number>>;
  readonly escorts: number;
}

const NODES: readonly NodeSetup[] = [
  {
    label: "sector 1 opening combat",
    kind: "combat",
    sector: 1,
    row: 0,
    level: 0,
    bonuses: {},
    escorts: 0,
  },
  {
    label: "sector 1 mid-map combat",
    kind: "combat",
    sector: 1,
    row: 3,
    level: 4,
    bonuses: { damage: 1, fireRate: 0.1, maxHull: 2 },
    escorts: 1,
  },
  {
    label: "sector 1 mid-map elite",
    kind: "elite",
    sector: 1,
    row: 3,
    level: 4,
    bonuses: { damage: 1, fireRate: 0.1, maxHull: 2 },
    escorts: 1,
  },
  {
    label: "sector 2 mid-map combat",
    kind: "combat",
    sector: 2,
    row: 3,
    level: 10,
    bonuses: {
      damage: 2,
      fireRate: 0.2,
      maxHull: 4,
      maxShields: 1,
      evasion: 1,
    },
    escorts: 2,
  },
];

async function runNode(
  page: Page,
  node: NodeSetup,
): Promise<{ ms: number; won: boolean; kills: number }> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(async (n) => {
    const game = (window as any).game;
    const { runServiceOf } =
      await import("/src/systems/survival/RoguelikeRunService.ts");
    const svc = runServiceOf(game.registry) as any;
    svc.startRun({
      faction: "terran_hegemony",
      flagshipId: "terran_viper",
      loadoutId: null,
      ascension: 0,
      seed: 4242,
    });
    svc.apply((r: any) => {
      const nodeId = r.map.rows[n.row][0].id;
      const escorts = Array.from({ length: n.escorts }, () => ({
        definitionId: "terran_viper",
        loadoutId: null,
        hull: 1,
        shields: 1,
        upgrades: 0,
      }));
      return {
        ...r,
        sector: n.sector,
        activeNodeId: nodeId,
        activeKind: n.kind,
        path: [nodeId],
        escorts,
        progression: {
          ...r.progression,
          level: n.level,
          escorts: n.escorts,
          branch: { ...r.progression.branch, gunnery: Math.round(n.level / 2) },
          bonuses: { ...r.progression.bonuses, ...n.bonuses },
        },
      };
    });
    game.scene.stop("MainMenuScene");
    game.scene.start("SurvivalScene", {
      factionId: "terran_hegemony",
      fromRun: true,
    });
  }, node);
  await waitForScene(page, "SurvivalScene", 30_000);
  await page.evaluate(() => {
    (window as any).game.scene.getScene("SurvivalScene").autopilot = true;
  });
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("SurvivalScene")?.battleEnded ===
      true,
    undefined,
    { timeout: MAX_NODE_MS, polling: 500 },
  );
  return page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SurvivalScene");
    return {
      ms: s.time.now - s.battleStartMs,
      won: s.playerShipIds.length > 0,
      kills: s.rules.killCount,
    };
  });
}

test.describe("Survival roguelite — battle node durations", () => {
  test.skip(
    !process.env["SURVIVAL_MEASURE"],
    "opt-in measurement: set SURVIVAL_MEASURE=1",
  );
  for (const node of NODES) {
    test(`measures a ${node.label}`, async ({ page }) => {
      test.setTimeout(MAX_NODE_MS + 60_000);
      suppressWebGLNoise(page);
      const result = await runNode(page, node);
      const seconds = (result.ms / 1000).toFixed(1);
      console.log(
        `[node-duration] ${node.label}: ${seconds}s, ${result.won ? "cleared" : "fleet lost"}, ${result.kills} kills`,
      );
      test
        .info()
        .annotations.push({
          type: "node-duration",
          description: `${node.label}: ${seconds}s (${result.won ? "cleared" : "lost"})`,
        });
      expect(result.ms).toBeGreaterThan(MIN_NODE_MS);
      expect(result.ms).toBeLessThan(MAX_NODE_MS);
    });
  }
});
