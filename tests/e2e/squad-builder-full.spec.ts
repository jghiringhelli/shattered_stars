/**
 * squad-builder-full.spec.ts — Comprehensive coverage of SquadBuilderScene.
 *
 * Covers what squad-builder.spec.ts does NOT test:
 *  1. UI text content — title, instructions, button labels
 *  2. ShipPickerScene integration — launch, simulate selection, verify squad update
 *  3. battleConfig registry shape — exact format including string teamIds
 *  4. Mode routing — survival→SurvivalScene, online→LobbyScene, continuous→ContinuousTacticalScene
 *  5. Post-battle ship verification — ArcadeBattleScene ships match configured factions/teams
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  suppressWebGLNoise,
  readSceneState,
} from "./helpers/game";

function suppressNoise(page: Page): void {
  suppressWebGLNoise(page as any);
}

async function openSquadBuilder(page: Page, mode = "SKIRMISH"): Promise<void> {
  await clickMenuItem(page, mode as any);
  await waitForScene(page, "SquadBuilderScene");
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return (s?.factionSlots?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );
}

/** Recursively collect all Text objects' strings from a Phaser scene. */
async function collectAllTexts(
  page: Page,
  sceneKey: string,
): Promise<string[]> {
  return page.evaluate((key: string) => {
    const scene = (window as any).game.scene.getScene(key) as any;
    if (!scene) return [];
    const collect = (obj: any): string[] => {
      const result: string[] = [];
      if (obj.text && typeof obj.text === "string") result.push(obj.text);
      if (obj.list)
        for (const c of obj.list as any[]) result.push(...collect(c));
      return result;
    };
    return (scene.children.list as any[]).flatMap(collect);
  }, sceneKey);
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — UI text content", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("SQUAD BUILDER title is present", async ({ page }) => {
    const texts = await collectAllTexts(page, "SquadBuilderScene");
    expect(texts.some((t) => t.includes("SQUAD BUILDER"))).toBe(true);
  });

  test("instruction text tells users how to set sides via T1–T4 chips", async ({
    page,
  }) => {
    const instr = await readSceneState<string>(
      page,
      "SquadBuilderScene",
      "instructionText.text",
    );
    expect(instr).toMatch(/T1.{1,5}T4/);
  });

  test("instruction text references Auto-Fill", async ({ page }) => {
    const instr = await readSceneState<string>(
      page,
      "SquadBuilderScene",
      "instructionText.text",
    );
    expect(instr.toLowerCase()).toContain("auto-fill");
  });

  test("instruction text mentions editing ships", async ({ page }) => {
    const instr = await readSceneState<string>(
      page,
      "SquadBuilderScene",
      "instructionText.text",
    );
    expect(instr.toLowerCase()).toContain("ship");
  });

  test("START BATTLE button label is rendered", async ({ page }) => {
    const texts = await collectAllTexts(page, "SquadBuilderScene");
    expect(texts.some((t) => t.includes("START BATTLE"))).toBe(true);
  });

  test("AUTO-FILL ALL button label is rendered", async ({ page }) => {
    const texts = await collectAllTexts(page, "SquadBuilderScene");
    expect(texts.some((t) => t.toUpperCase().includes("AUTO-FILL"))).toBe(true);
  });

  test("BACK navigation link is visible", async ({ page }) => {
    const texts = await collectAllTexts(page, "SquadBuilderScene");
    expect(texts.some((t) => t.includes("BACK"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — ShipPickerScene integration", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("editShips event launches ShipPickerScene as overlay", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squadListPanel.emit("editShips", { squadIdx: 0 });
    });
    await page.waitForFunction(
      () => (window as any).game.scene.isActive("ShipPickerScene"),
      { timeout: 5_000 },
    );
    const active = await page.evaluate(() =>
      (window as any).game.scene.isActive("ShipPickerScene"),
    );
    expect(active).toBe(true);
  });

  test("shipsPicked event updates squad ships array", async ({ page }) => {
    // Set editTarget by opening the picker
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squadListPanel.emit("editShips", { squadIdx: 0 });
    });
    await page.waitForFunction(
      () => (window as any).game.scene.isActive("ShipPickerScene"),
      { timeout: 5_000 },
    );

    // Emit shipsPicked to simulate user completing selection
    await page.evaluate(() => {
      (window as any).game.events.emit("shipsPicked", {
        slotIndex: 0,
        ships: ["confed_kestrel"],
        loadoutChoices: {},
        pointsUsed: 40,
      });
    });
    await page.waitForTimeout(200);

    const ships = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads[0].ships as string[];
    });
    expect(ships).toContain("confed_kestrel");
    expect(ships.length).toBe(1);
  });

  test("shipsPicked updates pointsUsed on the squad slot", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squadListPanel.emit("editShips", { squadIdx: 1 });
    });
    await page.waitForFunction(
      () => (window as any).game.scene.isActive("ShipPickerScene"),
      { timeout: 5_000 },
    );
    await page.evaluate(() => {
      (window as any).game.events.emit("shipsPicked", {
        slotIndex: 1,
        ships: ["corsair_venom", "corsair_venom"],
        loadoutChoices: {},
        pointsUsed: 58,
      });
    });
    await page.waitForTimeout(200);

    const points = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads[1].pointsUsed as number;
    });
    expect(points).toBe(58);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — battleConfig registry shape", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("battleConfig has factions array with correct structure", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.startBattle();
    });
    await page.waitForTimeout(200);

    const config = await page.evaluate(
      () => (window as any).game.registry.get("battleConfig") as any,
    );

    expect(config).toBeTruthy();
    expect(Array.isArray(config.factions)).toBe(true);
    expect(config.factions.length).toBeGreaterThanOrEqual(2);
    expect(config.gameMode).toBe("arcade");
    expect(config.pointLimit).toBe(200);

    const f = config.factions[0];
    expect(f).toHaveProperty("factionId");
    expect(f).toHaveProperty("controller");
    expect(Array.isArray(f.ships)).toBe(true);
  });

  test("teamId values in factions are string team_N format", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.startBattle();
    });
    await page.waitForTimeout(200);

    const teamIds = await page.evaluate(() => {
      const cfg = (window as any).game.registry.get("battleConfig") as any;
      return (cfg?.factions ?? []).map((f: any) => f.teamId) as string[];
    });

    expect(teamIds.length).toBeGreaterThanOrEqual(2);
    for (const id of teamIds) {
      expect(typeof id).toBe("string");
      expect(id).toMatch(/^team_\d+$/);
    }
    // Default 1v1 — two distinct teams
    const unique = new Set(teamIds);
    expect(unique.size).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — mode routing", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("survival mode routes to SurvivalScene", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.gameMode = "survival";
      s.startBattle();
    });
    await page.waitForFunction(
      () => (window as any).game.scene.isActive("SurvivalScene"),
      { timeout: 10_000 },
    );
    const active = await page.evaluate(() =>
      (window as any).game.scene.isActive("SurvivalScene"),
    );
    expect(active).toBe(true);
  });

  test("online mode routes to LobbyScene and sets online registry keys", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.gameMode = "online";
      s.startBattle();
    });
    await page.waitForFunction(
      () => (window as any).game.scene.isActive("LobbyScene"),
      { timeout: 10_000 },
    );

    const online = await page.evaluate(() => ({
      squad: (window as any).game.registry.get("onlineSquad"),
      faction: (window as any).game.registry.get("onlineFaction"),
      pointLimit: (window as any).game.registry.get("onlinePointLimit"),
    }));
    expect(Array.isArray(online.squad)).toBe(true);
    expect(typeof online.faction).toBe("string");
    expect(online.pointLimit).toBe(200);
  });

  test("continuous mode routes to ContinuousTacticalScene", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.gameMode = "continuous";
      s.startBattle();
    });
    await page.waitForFunction(
      () => (window as any).game.scene.isActive("ContinuousTacticalScene"),
      { timeout: 10_000 },
    );
    const active = await page.evaluate(() =>
      (window as any).game.scene.isActive("ContinuousTacticalScene"),
    );
    expect(active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — post-battle ship verification", () => {
  test("arcade battle ships match configured factions", async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);

    // Assign specific, distinct factions so we can verify both sides
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squads[0].factionId = "void_corsairs";
      s.squads[0].controller = "player";
      s.squads[1].factionId = "synthetic_collective";
      s.squads[1].controller = "ai";
      s.squadListPanel.autoFillAll();
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      (window as any).game.scene.getScene("SquadBuilderScene")?.startBattle();
    });

    await waitForScene(page, "ArcadeBattleScene");
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("ArcadeBattleScene")
          ?.playerShipId != null,
      { timeout: 15_000 },
    );

    const ships = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      return [...(scene.ships?.values() ?? [])].map((s: any) => ({
        faction: s.faction as string,
        owner: s.owner as string,
      }));
    });

    const playerShips = ships.filter((s) => s.owner === "player");
    const aiShips = ships.filter((s) => s.owner === "ai");

    expect(playerShips.length).toBeGreaterThan(0);
    expect(aiShips.length).toBeGreaterThan(0);
    expect(playerShips.every((s) => s.faction === "void_corsairs")).toBe(true);
    expect(aiShips.every((s) => s.faction === "synthetic_collective")).toBe(
      true,
    );
  });

  test("player ship in battle corresponds to the player-controlled slot", async ({
    page,
  }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);

    await page.evaluate(() => {
      (window as any).game.scene.getScene("SquadBuilderScene")?.startBattle();
    });

    await waitForScene(page, "ArcadeBattleScene");
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("ArcadeBattleScene")
          ?.playerShipId != null,
      { timeout: 15_000 },
    );

    const playerInfo = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const ship = scene.ships?.get(scene.playerShipId) as any;
      return ship ? { owner: ship.owner, faction: ship.faction } : null;
    });

    expect(playerInfo).not.toBeNull();
    expect(playerInfo!.owner).toBe("player");
    expect(typeof playerInfo!.faction).toBe("string");
  });
});
