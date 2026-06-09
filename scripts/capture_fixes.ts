import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const OUT = join("screenshots", "vqa", "fixes");
mkdirSync(OUT, { recursive: true });

(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } });

  pg.on("console", (m) => {
    if (
      m.type() === "error" &&
      !m.text().includes("Failed to process") &&
      !m.text().includes("WebGL")
    )
      console.warn("[err]", m.text());
  });

  await pg.goto("http://localhost:3003");
  await pg.waitForFunction(() => (window as any).game?.isBooted, {
    timeout: 15_000,
  });
  await pg.waitForTimeout(3_000);

  const shot = async (name: string) => {
    const f = join(OUT, name + ".png");
    await pg.screenshot({ path: f });
    console.log("📸", f);
  };

  const waitScene = async (key: string) => {
    await pg.waitForFunction(
      (k: string) => (window as any).game?.scene?.isActive(k),
      key,
      { timeout: 15_000 },
    );
    await pg.waitForTimeout(900);
  };

  // Squad builder 2 factions
  await pg.evaluate(() => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    setTimeout(
      () => g.scene.start("SquadBuilderScene", { initialMode: "turn_based" }),
      200,
    );
  });
  await waitScene("SquadBuilderScene");
  await shot("01_squad_2factions");

  // Squad builder 4 factions
  await pg.evaluate(() => {
    const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
    if (typeof s.setNumFactions === "function") s.setNumFactions(4);
    else {
      s.numFactions = 4;
      if (typeof s.updateDisplay === "function") s.updateDisplay();
    }
  });
  await pg.waitForTimeout(600);
  await shot("02_squad_4factions");

  // Turn-based 2 factions
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
    setTimeout(() => g.scene.start("TurnBasedBattleScene"), 200);
  });
  await waitScene("TurnBasedBattleScene");
  await pg.waitForTimeout(1_500);
  await shot("03_tb_2factions");

  // Turn-based 3 factions
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
    setTimeout(() => g.scene.start("TurnBasedBattleScene"), 200);
  });
  await waitScene("TurnBasedBattleScene");
  await pg.waitForTimeout(1_500);
  await shot("04_tb_3factions");

  await br.close();
  console.log("\nDone →", OUT);
})();
