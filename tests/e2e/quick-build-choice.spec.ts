/**
 * quick-build-choice.spec.ts — Phase 6: the player can see what a quick
 * build really is, and pick one where there was no picker before.
 *
 *  (a) Ship picker detail panel: an ace loadout shows its pilot name,
 *      initiative and the pilot ability's real-time summary.
 *  (b) Dogfight setup: real mouse clicks (scrollFactor(0) UI at camera
 *      zoom 1.0) pick a listed ship and cycle its quick-build chooser to a
 *      non-default loadout; the spawned player ship flies exactly that one.
 *  (c) Survival / Ace Duel setup: the same pick reaches the battle.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickGameCoord,
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

/** The ace build under test: Poison Fang flies the Fang Raider build. */
const FANG_SHIP = "corsair_fang";
const FANG_ACE_LOADOUT = "fang_raider";
const FANG_ACE_PILOT = "poison_fang";
/** The ambush ability's real-time effect, as the picker reads it. */
const AMBUSH_SUMMARY = "+1 laser dmg from behind the target";

/** Every Text string in a scene, containers included. */
async function sceneTexts(page: Page, sceneKey: string): Promise<string[]> {
  return page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    const collect = (obj: any): string[] => [
      ...(typeof obj.text === "string" ? [obj.text] : []),
      ...((obj.list as any[] | undefined) ?? []).flatMap(collect),
    ];
    return (scene.children.list as any[]).flatMap(collect);
  }, sceneKey);
}

/**
 * Real mouse click on the centre of the first object (searched through
 * containers) matching a name or exact text. Returns false when absent.
 */
async function clickObject(
  page: Page,
  sceneKey: string,
  match: { name?: string; text?: string },
): Promise<boolean> {
  const centre = await page.evaluate(
    ({ key, name, text }) => {
      const scene = (window as any).game.scene.getScene(key);
      const find = (list: any[]): any =>
        list.reduce<any>(
          (hit, obj) =>
            hit ??
            ((name !== undefined && obj.name === name) ||
            (text !== undefined && obj.text === text)
              ? obj
              : find(obj.list ?? [])),
          null,
        );
      const obj = find(scene.children.list);
      if (!obj) return null;
      const bounds = obj.getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    },
    { key: sceneKey, ...match },
  );
  if (!centre) return false;
  await clickGameCoord(page, centre.x, centre.y);
  return true;
}

/**
 * Real-click the BUILDS-tab chip of another quick build of ship `index`
 * (setup scenes keep the pick in `playerBuilds`); returns the new pick.
 */
async function pickOtherBuild(
  page: Page,
  scene: string,
  index: number,
): Promise<string> {
  const target = await page.evaluate(
    async ({ key, i }) => {
      const { getLoadoutById } = await import("/src/data/ShipLoadouts.ts");
      const { quickBuildOptions } =
        await import("/src/arcade/systems/QuickBuildChoice.ts");
      const s = (window as any).game.scene.getScene(key);
      const current = s.playerBuilds.loadoutIds[i];
      const other = quickBuildOptions(s.playerBuilds.shipIds[i]).find(
        (id: string) => id !== current,
      )!;
      const loadout = getLoadoutById(other)!;
      return {
        id: other,
        label: `${loadout.name.toUpperCase()} \u00b7 ${loadout.pointCost}`,
      };
    },
    { key: scene, i: index },
  );
  expect(await clickObject(page, scene, { text: target.label })).toBe(true);
  await page.waitForFunction(
    ({ key, i, id }) =>
      (window as any).game.scene.getScene(key).playerBuilds.loadoutIds[i] === id,
    { key: scene, i: index, id: target.id },
  );
  return target.id;
}

test.describe("Ship picker — what a quick build really is", () => {
  test("an ace loadout shows pilot name, initiative and ability summary", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const game = (window as any).game;
      game.scene.stop("MainMenuScene");
      game.scene.start("ShipPickerScene", {
        slotIndex: 0,
        factionId: "void_corsairs",
        selectedShips: [],
        pointLimit: 200,
      });
    });
    await waitForScene(page, "ShipPickerScene");
    await clickObject(page, "ShipPickerScene", { text: "GOT IT" });
    await page.evaluate((shipId) => {
      const catalog = (window as any).game.scene.getScene(
        "ShipPickerScene",
      ).catalogPanel;
      catalog.staging.selectShip(shipId);
      catalog.render();
    }, FANG_SHIP);

    const buttonLabel = await page.evaluate(async (loadoutId) => {
      const { getLoadoutById } = await import("/src/data/ShipLoadouts.ts");
      const loadout = getLoadoutById(loadoutId)!;
      return `${loadout.name.toUpperCase()} \u00b7 ${loadout.pointCost}`;
    }, FANG_ACE_LOADOUT);
    // The overlay's detail panel is narrow (only the open tab is labelled): open tabs directly.
    await page.evaluate(() =>
      (window as any).game.scene
        .getScene("ShipPickerScene")
        .catalogPanel.detailPanel.open("builds"),
    );
    expect(
      await clickObject(page, "ShipPickerScene", { text: buttonLabel }),
    ).toBe(true);
    await page.waitForFunction(
      (id) =>
        (window as any).game.scene
          .getScene("ShipPickerScene")
          .catalogPanel.staging.getSelectedLoadoutId() === id,
      FANG_ACE_LOADOUT,
    );

    await page.evaluate(() =>
      (window as any).game.scene
        .getScene("ShipPickerScene")
        .catalogPanel.detailPanel.open("pilot"),
    );
    const initiative = await page.evaluate(async (pilotId) => {
      const { PILOT_CARDS } = await import("/src/systems/SquadBuilder.ts");
      return PILOT_CARDS[pilotId]!.initiative;
    }, FANG_ACE_PILOT);
    const texts = await sceneTexts(page, "ShipPickerScene");
    expect(texts).toContain("\u2605 Poison Fang");
    expect(texts.some((t) => t.startsWith(`Initiative ${initiative}`))).toBe(
      true,
    );
    expect(texts).toContain("ABILITY \u2014 Ambush");
    expect(texts.some((t) => t.includes(AMBUSH_SUMMARY))).toBe(true);
  });
});

test.describe("Dogfight setup — quick-build chooser", () => {
  test("a non-default pick reaches the spawned player ship", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/?debug=1");
    await waitForMenuReady(page);
    await clickMenuItem(page, "DOGFIGHT");
    await waitForScene(page, "DogfightScene", 30_000);

    // The default Raven offers two quick builds: open BUILDS and pick the other chip.
    expect(await clickObject(page, "DogfightScene", { text: "BUILDS" })).toBe(true);
    const chosenId = await pickOtherBuild(page, "DogfightScene", 0);

    expect(await clickObject(page, "DogfightScene", { text: "FIGHT!" })).toBe(
      true,
    );
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("DogfightScene").ships?.size ??
          0) >= 2,
      undefined,
      { timeout: 15_000 },
    );
    const spawned = await page.evaluate(
      () =>
        (window as any).game.scene
          .getScene("DogfightScene")
          .ships.get("player_0").loadoutId,
    );
    expect(spawned).toBe(chosenId);
  });
});

test.describe("Survival / Ace Duel setup — quick-build chooser", () => {
  test("Survival: the flagship flies the picked quick build", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/?debug=1");
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const game = (window as any).game;
      game.scene.stop("MainMenuScene");
      game.scene.start("SurvivalSetupScene");
    });
    await waitForScene(page, "SurvivalSetupScene");
    expect(
      await clickObject(page, "SurvivalSetupScene", { text: "BUILDS" }),
    ).toBe(true);
    const chosen = await pickOtherBuild(page, "SurvivalSetupScene", 0);
    expect(
      await clickObject(page, "SurvivalSetupScene", { text: "LAUNCH" }),
    ).toBe(true);
    // LAUNCH opens the Survival sector map; the run's flagship carries the pick.
    await waitForScene(page, "SurvivalMapScene", 30_000);
    const flagship = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SurvivalMapScene");
      return scene.run.flagship.loadoutId;
    });
    expect(flagship).toBe(chosen);
  });

  test("Ace Duel: the player's ship flies the picked quick build", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/?debug=1");
    await waitForMenuReady(page);
    await clickMenuItem(page, "ACE DUEL");
    await waitForScene(page, "AceDuelScene", 30_000);
    const found = await page.evaluate(async () => {
      const { quickBuildOptions } =
        await import("/src/arcade/systems/QuickBuildChoice.ts");
      const { ACE_MATCHUPS } = await import("/src/data/AceMatchups.ts");
      const scene = (window as any).game.scene.getScene("AceDuelScene");
      for (const matchup of ACE_MATCHUPS) {
        for (const side of [1, 2] as const) {
          const ships = side === 1 ? matchup.side1.ships : matchup.side2.ships;
          if (quickBuildOptions(ships[0]!).length < 2) continue;
          scene.selectedMatchup = matchup;
          scene.playerSide = side;
          scene.showSetupScreen();
          return true;
        }
      }
      return false;
    });
    expect(found).toBe(true);
    expect(await clickObject(page, "AceDuelScene", { text: "BUILDS" })).toBe(true);
    const chosen = await pickOtherBuild(page, "AceDuelScene", 0);
    expect(await clickObject(page, "AceDuelScene", { text: "DUEL!" })).toBe(
      true,
    );
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("AceDuelScene").ships?.size ??
          0) >= 2,
      undefined,
      { timeout: 15_000 },
    );
    const spawned = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("AceDuelScene");
      return scene.ships.get(`side${scene.playerSide}_0`).loadoutId;
    });
    expect(spawned).toBe(chosen);
  });
});
