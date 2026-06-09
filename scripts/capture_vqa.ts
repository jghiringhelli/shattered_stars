import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3003";
const OUT = "screenshots/vqa/current";
fs.mkdirSync(OUT, { recursive: true });

async function shot(page: any, n: string) {
  const f = path.join(OUT, n + ".png");
  await page.screenshot({ path: f });
  console.log("📸", f);
}

async function wait(page: any, key: string) {
  await page.waitForFunction(
    (k: string) => (window as any).game?.scene?.isActive(k),
    key,
    { timeout: 20000 },
  );
  await page.waitForTimeout(1000);
}

async function jump(page: any, key: string, cfg?: any) {
  await page.evaluate(
    ([k, c]: any) => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      setTimeout(() => g.scene.start(k, c), 150);
    },
    [key, cfg],
  );
}

(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto(BASE);
  await pg.waitForFunction(() => (window as any).game?.isBooted, {
    timeout: 15000,
  });
  await pg.waitForTimeout(2500);

  // Squad builder 2 factions (default)
  await jump(pg, "SquadBuilderScene", { initialMode: "turn_based" });
  await wait(pg, "SquadBuilderScene");
  await shot(pg, "01_squad_2factions");

  // Set to 4 factions
  await pg.evaluate(() => {
    const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
    if (typeof s.setNumFactions === "function") s.setNumFactions(4);
    else if (typeof s.updateDisplay === "function") {
      s.numFactions = 4;
      s.updateDisplay();
    }
  });
  await pg.waitForTimeout(600);
  await shot(pg, "02_squad_4factions");

  // Set to 6 factions
  await pg.evaluate(() => {
    const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
    if (typeof s.setNumFactions === "function") s.setNumFactions(6);
    else {
      s.numFactions = 6;
      if (typeof s.updateDisplay === "function") s.updateDisplay();
    }
  });
  await pg.waitForTimeout(600);
  await shot(pg, "03_squad_6factions");

  // Turn-based battle start — 2 factions
  await pg.evaluate(() => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "terran_hegemony",
          controller: "player",
          ships: ["terran_gladius", "terran_viper", "terran_lance"],
        },
        {
          factionId: "free_confederation",
          controller: "ai",
          ships: ["confed_falcon", "confed_sparrow", "confed_hawk"],
        },
      ],
      gameMode: "turn_based",
      pointLimit: 200,
    });
    setTimeout(() => g.scene.start("TurnBasedBattleScene"), 150);
  });
  await wait(pg, "TurnBasedBattleScene");
  await pg.waitForTimeout(1500);
  await shot(pg, "04_tb_battle_2factions_start");

  // Turn-based battle — 3 factions
  await pg.evaluate(() => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "terran_hegemony",
          controller: "player",
          ships: ["terran_gladius", "terran_viper"],
        },
        {
          factionId: "free_confederation",
          controller: "ai",
          ships: ["confed_falcon", "confed_sparrow"],
        },
        {
          factionId: "void_corsairs",
          controller: "ai",
          ships: ["corsair_scimitar", "corsair_rapier"],
        },
      ],
      gameMode: "turn_based",
      pointLimit: 200,
    });
    setTimeout(() => g.scene.start("TurnBasedBattleScene"), 150);
  });
  await wait(pg, "TurnBasedBattleScene");
  await pg.waitForTimeout(1500);
  await shot(pg, "05_tb_battle_3factions_start");

  // Survival
  await jump(pg, "SurvivalScene", { factionId: "terran_hegemony" });
  await wait(pg, "SurvivalScene");
  await pg.waitForTimeout(2000);
  await shot(pg, "06_survival");

  // AceDuel
  await jump(pg, "AceDuelScene");
  await wait(pg, "AceDuelScene");
  await pg.waitForTimeout(800);
  await shot(pg, "07_ace_duel");

  // Campaign
  await jump(pg, "CampaignScene");
  await wait(pg, "CampaignScene");
  await pg.waitForTimeout(800);
  await shot(pg, "08_campaign");

  // DogfightScene
  await jump(pg, "DogfightScene");
  await wait(pg, "DogfightScene");
  await pg.waitForTimeout(1200);
  await shot(pg, "09_dogfight");

  console.log("\nDone – screenshots in", OUT);
  await br.close();
})();
