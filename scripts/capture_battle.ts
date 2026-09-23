/**
 * capture_battle.ts — screenshot a live arcade battle for visual review.
 *
 * Complements qa_review_shots.ts, which only covers menu and flow scenes.
 * Ship rendering can only be judged in a real battle, over a real background.
 *
 * Usage: npx tsx scripts/capture_battle.ts [playerShipId] [enemyShipIds,csv]
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env["QA_BASE_URL"] ?? "http://localhost:3000";
const OUT_DIR = path.join("screenshots", "review");

const playerShip = process.argv[2] ?? "confed_kestrel";
const enemyShips = (
  process.argv[3] ?? "corsair_venom,corsair_marauder,corsair_talon"
).split(",");

/** Milliseconds to let the battle settle so ships have spread out. */
const SETTLE_MS = 3000;

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `battle_${playerShip}.png`);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.goto(BASE_URL);

  await page.waitForFunction(
    () => (window as any).game?.scene?.getScenes(true).length > 0,
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500);

  await page.evaluate(
    ([player, enemies]: [string, string[]]) => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("battleConfig", {
        factions: [
          {
            factionId: "free_confederation",
            controller: "player",
            ships: [player],
          },
          { factionId: "void_corsairs", controller: "ai", ships: enemies },
        ],
        gameMode: "arcade",
      });
      setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
    },
    [playerShip, enemyShips] as [string, string[]],
  );

  await page.waitForFunction(
    () =>
      (window as any).game?.scene?.getScene("ArcadeBattleScene")
        ?.playerShipId != null,
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: outPath });
  console.log("wrote", outPath);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
