/**
 * qa_review_shots.ts — capture one screenshot per menu/flow scene for visual review.
 * Usage: npx tsx scripts/qa_review_shots.ts [baseUrl]
 */
import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const OUT_DIR = path.join("screenshots", "review");

const SCENES = [
  "MainMenuScene",
  "SquadBuilderScene",
  "ShipPickerScene",
  "SurvivalSetupScene",
  "CampaignScene",
  "EncyclopediaScene",
  "SettingsScene",
  "ControlsScene",
  "CreditsScene",
  "LobbyScene",
  "DebriefScene",
];

async function waitForScene(
  page: Page,
  key: string,
  ms = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (k: string) => {
      const g = (window as unknown as { game?: Phaser.Game }).game as any;
      return g?.scene
        ?.getScenes(true)
        .some((s: any) => s.sys?.settings?.key === k);
    },
    key,
    { timeout: ms },
  );
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  await page.goto(BASE_URL);
  await waitForScene(page, "MainMenuScene", 30_000);
  await page.waitForTimeout(2500);

  for (const key of SCENES) {
    try {
      await page.evaluate((k: string) => {
        const g = (window as any).game;
        g.scene
          .getScenes(true)
          .forEach((s: any) => g.scene.stop(s.sys.settings.key));
        setTimeout(() => g.scene.start(k), 120);
      }, key);
      await waitForScene(page, key);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(OUT_DIR, `${key}.png`) });
      console.log(`ok   ${key}`);
    } catch (e) {
      console.log(`FAIL ${key}: ${(e as Error).message.split("\n")[0]}`);
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "errors.json"),
    JSON.stringify(errors, null, 2),
  );
  console.log(
    `\n${errors.length} console/page errors -> ${OUT_DIR}/errors.json`,
  );
  await browser.close();
}

void main();
