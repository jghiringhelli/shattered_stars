/**
 * pick-screens-duels-codex.spec.ts — the Dogfight / Ace Duel / Boss Raid
 * setups, the reserve editor and the encyclopedia ship detail: one tab or
 * data set visible at a time (mouse and Q / E), hover tooltips (short, then
 * full on hold), the flown-points strips of both sides, the text-density and
 * 12 px rules at 1280x720, and a screenshot of every screen and tab at
 * 1280x720 and 1920x1080 (saved to $TEMP as pick-duel-<screen>-<w>x<h>.png).
 */

import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import {
  clickText,
  hoverText,
  sceneTexts,
  tooltip,
  tooltipExpanded,
} from "./helpers/pickScreens";

type Size = { width: number; height: number };

const SIZES: readonly Size[] = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];
const DUEL_TABS = ["OVERVIEW", "STATS", "BUILDS", "MATCH"] as const;
const RAID_TABS = ["OVERVIEW", "ABILITIES", "MATCH"] as const;
const CODEX_TABS = ["OVERVIEW", "STATS", "LOADOUT", "LORE"] as const;
/** Most distinct text elements a pick screen may show at 1280x720. */
const MAX_TEXTS = 36;
/**
 * The encyclopedia lists ~16 ship rows (plus tabs and filters) beside the
 * detail, so its budget is the detail's own ~35 on top of that column.
 */
const MAX_CODEX_TEXTS = 70;
/** Smallest readable font size (px) at 1280x720. */
const MIN_FONT = 12;
/** Longer than the tooltip's hold delay, so the full explanation shows. */
const HOLD_MS = 1100;

async function openMenu(page: Page, size: Size): Promise<void> {
  await page.setViewportSize(size);
  suppressWebGLNoise(page);
  await page.goto("/");
  await waitForMenuReady(page);
}

async function shot(page: Page, name: string, size: Size): Promise<void> {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: join(tmpdir(), `pick-duel-${name}-${size.width}x${size.height}.png`),
  });
}

/** Visible, on-screen Text objects of a scene (optionally inside a rect) with their font size. */
async function onScreenTexts(
  page: Page,
  key: string,
  rect?: { x: number; y: number; width: number; height: number },
): Promise<Array<{ text: string; size: number }>> {
  return page.evaluate(
    ({ k, r }) => {
      const g = (window as any).game;
      const scene = g.scene.getScene(k);
      const box = r ?? { x: 0, y: 0, width: g.scale.gameSize.width, height: g.scale.gameSize.height };
      const out: Array<{ text: string; size: number }> = [];
      const walk = (obj: any, parentVisible: boolean): void => {
        const visible = parentVisible && obj.visible !== false && obj.alpha !== 0;
        if (typeof obj.text === "string" && obj.text.trim() && visible) {
          const b = obj.getBounds();
          const inside =
            b.right > box.x && b.left < box.x + box.width && b.bottom > box.y && b.top < box.y + box.height;
          if (inside) out.push({ text: obj.text, size: parseFloat(String(obj.style?.fontSize ?? "0")) });
        }
        for (const child of (obj.list as any[] | undefined) ?? []) walk(child, visible);
      };
      for (const obj of scene.children.list as any[]) walk(obj, true);
      return out;
    },
    { k: key, r: rect ?? null },
  );
}

/** Density rules at 1280x720: few text elements, none under 12 px. */
async function expectDense(
  page: Page,
  scene: string,
  size: Size,
  label: string,
  max: number = MAX_TEXTS,
  startsAt?: string,
): Promise<void> {
  if (size.width !== 1280) return;
  const all = await onScreenTexts(page, scene);
  const from = startsAt ? all.findIndex((t) => t.text.startsWith(startsAt)) : 0;
  const texts = all.slice(Math.max(0, from));
  console.log(`TEXTS ${label}: ${texts.length}`);
  expect(texts.length, `${label}: ${texts.map((t) => t.text).join(" | ")}`).toBeLessThanOrEqual(max);
  expect(texts.filter((t) => t.size < MIN_FONT).map((t) => `${t.text}@${t.size}`), label).toEqual([]);
}

/** A text each tab's body shows and no other tab shows. */
const TAB_MARKERS: Record<string, Record<string, RegExp>> = {
  duelSetup: {
    overview: /^(YOUR SHIP|MATCHUPS)/,
    stats: /^(YOUR SHIP|ENEMY)\s{2}\S|^(Admiral Kronos|Phoenix Commander|HULL)$/,
    builds: /^WHEN TO PICK IT$/,
    match: /^AI DIFFICULTY$/,
  },
  raidSetup: {
    overview: /^Escorts: /,
    abilities: /^BROADSIDE$/,
    match: /^RAID DIFFICULTY$/,
  },
};

/** Waits until the screen's body is the one of this tab. */
async function expectTab(page: Page, scene: string, screen: string, tab: string): Promise<void> {
  const marker = TAB_MARKERS[screen]![tab.toLowerCase()]!;
  await expect
    .poll(async () => (await sceneTexts(page, scene)).some((t) => marker.test(t)), { message: `${screen} ${tab}` })
    .toBe(true);
}

/** The ship detail's open tab. */
async function codexTab(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).game.scene.getScene("EncyclopediaScene").detailPanel.openTab);
}
/** Hover an element, read the short tooltip, hold, read the full one. */
async function expectShortThenFull(
  page: Page,
  scene: string,
  text: string,
  short: RegExp,
  full: RegExp,
): Promise<void> {
  await hoverText(page, scene, text);
  await expect.poll(() => tooltip(page, scene)).toMatch(short);
  expect(await tooltipExpanded(page, scene)).toBe(false);
  expect(await tooltip(page, scene)).not.toMatch(full);
  await page.waitForTimeout(HOLD_MS);
  expect(await tooltipExpanded(page, scene)).toBe(true);
  expect(await tooltip(page, scene)).toMatch(full);
}

async function openDogfight(page: Page, size: Size): Promise<void> {
  await openMenu(page, size);
  await clickMenuItem(page, "DOGFIGHT");
  await waitForScene(page, "DogfightScene", 30_000);
  await page.waitForFunction(() => (window as any).game.scene.getScene("DogfightScene").setupObjects?.length > 0);
}

async function openAce(page: Page, size: Size): Promise<void> {
  await openMenu(page, size);
  await clickMenuItem(page, "ACE DUEL");
  await waitForScene(page, "AceDuelScene", 30_000);
  await page.waitForFunction(() => (window as any).game.scene.getScene("AceDuelScene").setupObjects?.length > 0);
}

async function openRaid(page: Page, size: Size): Promise<void> {
  await openMenu(page, size);
  await clickMenuItem(page, "BOSS RAID");
  await waitForScene(page, "EpicBattleScene", 30_000);
  await page.waitForFunction(() => (window as any).game.scene.getScene("EpicBattleScene").setupRoot != null);
}

async function openCodex(page: Page, size: Size): Promise<void> {
  await openMenu(page, size);
  await clickMenuItem(page, "ENCYCLOPEDIA");
  await waitForScene(page, "EncyclopediaScene");
  await page.waitForFunction(() => ((window as any).game.scene.getScene("EncyclopediaScene").filteredEntries?.length ?? 0) > 0);
  await page.waitForTimeout(600);
}

async function openReserveEditor(page: Page, size: Size): Promise<void> {
  await openMenu(page, size);
  await page.evaluate(() => {
    const g = (window as any).game;
    g.registry.set("scenarioChoice", null);
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.scene.start("SquadBuilderScene", { initialMode: "arcade" });
  });
  await waitForScene(page, "SquadBuilderScene");
  await page.waitForFunction(() => (window as any).game.scene.getScene("SquadBuilderScene").reinforcementSetup !== null);
  await page.evaluate(() => (window as any).game.scene.getScene("SquadBuilderScene").reinforcementSetup.openEditor());
  await page.waitForTimeout(300);
}

/** The strip's two number texts ("YOU 54 pt" / "40 pt  ENEMY") as numbers. */
async function stripPoints(page: Page, scene: string): Promise<{ you: number; enemy: number }> {
  const texts = await sceneTexts(page, scene);
  const you = texts.find((t) => /^YOU\s+\d+ pt$/.test(t));
  const enemy = texts.find((t) => /^\d+ pt\s+ENEMY$/.test(t));
  expect(you, "YOU points text").toBeDefined();
  expect(enemy, "ENEMY points text").toBeDefined();
  return { you: parseInt(you!.replace(/\D+/g, ""), 10), enemy: parseInt(enemy!.replace(/\D+/g, ""), 10) };
}

test.describe("Dogfight setup", () => {
  for (const size of SIZES) {
    test(`every tab at ${size.width}x${size.height}`, async ({ page }) => {
      await openDogfight(page, size);
      for (const tab of DUEL_TABS) {
        await clickText(page, "DogfightScene", tab);
        await expectTab(page, "DogfightScene", "duelSetup", tab);
        await shot(page, `dogfight-${tab.toLowerCase()}`, size);
        await expectDense(page, "DogfightScene", size, `dogfight ${tab}`);
      }
    });
  }

  test("the points strip shows both sides and follows the build", async ({ page }) => {
    await openDogfight(page, SIZES[0]!);
    const before = await stripPoints(page, "DogfightScene");
    expect(before.you).toBeGreaterThan(0);
    expect(before.enemy).toBeGreaterThan(0);
    await clickText(page, "DogfightScene", "BUILDS");
    const other = await page.evaluate(async () => {
      const { getLoadoutById } = await import("/src/data/ShipLoadouts.ts");
      const { quickBuildOptions } = await import("/src/arcade/systems/QuickBuildChoice.ts");
      const s = (window as any).game.scene.getScene("DogfightScene");
      const id = quickBuildOptions(s.playerShipId).find((b: string) => b !== s.playerBuilds.loadoutIds[0])!;
      const loadout = getLoadoutById(id)!;
      return { label: `${loadout.name.toUpperCase()} \u00b7 ${loadout.pointCost}`, cost: loadout.pointCost };
    });
    await clickText(page, "DogfightScene", other.label);
    await expect.poll(async () => (await stripPoints(page, "DogfightScene")).you).toBe(other.cost);
    expect((await stripPoints(page, "DogfightScene")).enemy).toBe(before.enemy);
    expect((await sceneTexts(page, "DogfightScene")).some((t) => /fly|Even duel/.test(t))).toBe(true);
  });

  test("Q / E step through the tabs and a tab click re-renders one body", async ({ page }) => {
    await openDogfight(page, SIZES[0]!);
    await expectTab(page, "DogfightScene", "duelSetup", "overview");
    await page.keyboard.press("e");
    await expectTab(page, "DogfightScene", "duelSetup", "stats");
    await page.keyboard.press("e");
    await expectTab(page, "DogfightScene", "duelSetup", "builds");
    await page.keyboard.press("q");
    await expectTab(page, "DogfightScene", "duelSetup", "stats");
    const texts = await sceneTexts(page, "DogfightScene");
    expect(texts).toContain("HULL");
    expect(texts).not.toContain("AI DIFFICULTY");
  });

  test("tags explain themselves: short on hover, full on hold", async ({ page }) => {
    await openDogfight(page, SIZES[0]!);
    await expectShortThenFull(page, "DogfightScene", "MATCH", /Match tab/, /Open MATCH, pick Best of 5/);
    await clickText(page, "DogfightScene", "MATCH");
    await page.mouse.move(2, 2);
    await expectShortThenFull(page, "DogfightScene", "HARD", /Hard AI/, /Fly straight for two cycles/);
    await clickText(page, "DogfightScene", "HARD");
    expect(await sceneTexts(page, "DogfightScene")).toContain(
      "Hard: an expert that plans one cycle ahead and flanks anyone who flies straight.",
    );
    await page.mouse.move(2, 2);
    await expectShortThenFull(page, "DogfightScene", "BEST OF 5", /Best of 5/, /3-2 comeback/);
  });
});

test.describe("Ace Duel setup", () => {
  for (const size of SIZES) {
    test(`every tab at ${size.width}x${size.height}`, async ({ page }) => {
      await openAce(page, size);
      for (const tab of DUEL_TABS) {
        await clickText(page, "AceDuelScene", tab);
        await expectTab(page, "AceDuelScene", "duelSetup", tab);
        await shot(page, `ace-${tab.toLowerCase()}`, size);
        await expectDense(page, "AceDuelScene", size, `ace ${tab}`);
      }
    });
  }

  test("both aces' points show and the side choice moves them", async ({ page }) => {
    await openAce(page, SIZES[0]!);
    const before = await stripPoints(page, "AceDuelScene");
    await clickText(page, "AceDuelScene", "MATCH");
    await clickText(page, "AceDuelScene", "PHOENIX COMMANDER");
    await expect.poll(() => stripPoints(page, "AceDuelScene")).toEqual({ you: before.enemy, enemy: before.you });
  });

  test("ace abilities explain themselves on the builds tab", async ({ page }) => {
    await openAce(page, SIZES[0]!);
    await clickText(page, "AceDuelScene", "BUILDS");
    await expectShortThenFull(page, "AceDuelScene", "MARKSMANSHIP", /Marksmanship/i, /real-time effect/);
  });
});

test.describe("Boss Raid setup", () => {
  for (const size of SIZES) {
    test(`every tab at ${size.width}x${size.height}`, async ({ page }) => {
      await openRaid(page, size);
      for (const tab of RAID_TABS) {
        await clickText(page, "EpicBattleScene", tab);
        await expectTab(page, "EpicBattleScene", "raidSetup", tab);
        await shot(page, `raid-${tab.toLowerCase()}`, size);
        await expectDense(page, "EpicBattleScene", size, `raid ${tab}`);
      }
    });
  }

  test("difficulty and boss numbers explain themselves, Q / E switch tabs", async ({ page }) => {
    await openRaid(page, SIZES[0]!);
    await page.keyboard.press("e");
    await expectTab(page, "EpicBattleScene", "raidSetup", "abilities");
    await page.keyboard.press("e");
    await expectTab(page, "EpicBattleScene", "raidSetup", "match");
    await expectShortThenFull(page, "EpicBattleScene", "HARD 1.5x", /Hard raid/, /2160 hull/);
    await clickText(page, "EpicBattleScene", "MYTHIC 2x");
    await expect
      .poll(async () => (await sceneTexts(page, "EpicBattleScene")).some((t) => t.startsWith("Mythic:")))
      .toBe(true);
  });
});

test.describe("Reserve editor", () => {
  for (const size of SIZES) {
    test(`screenshot at ${size.width}x${size.height}`, async ({ page }) => {
      await openReserveEditor(page, size);
      await shot(page, "reserve-editor", size);
      await expectDense(page, "SquadBuilderScene", size, "reserve editor", MAX_TEXTS, "RESERVE \u2014");
    });
  }

  test("plain-language pool, cap and quota sentences are on screen and explained", async ({ page }) => {
    await openReserveEditor(page, SIZES[0]!);
    const texts = await sceneTexts(page, "SquadBuilderScene");
    expect(texts.some((t) => t.startsWith("Pool 1000: every ship you deploy spends points"))).toBe(true);
    expect(texts.some((t) => t.startsWith("On-field cap 250: at most 250 flown points"))).toBe(true);
    // The bomber quota comes from the reinforcement rules (balance round 4: 4 on the field).
    expect(texts.some((t) => t.startsWith("Mix limits on the field at once: up to 4 bombers"))).toBe(true);
    await expectShortThenFull(
      page,
      "SquadBuilderScene",
      texts.find((t) => t.startsWith("Pool 1000"))!,
      /Pool/,
      /Pool 1000 with a 200 pt opening squad/,
    );
    await page.mouse.move(2, 2);
    await expectShortThenFull(page, "SquadBuilderScene", "SWARM", /Swarm strategy/, /Eight cheap light fighters/);
  });

  test("a clicked row is selected and the arrows move it", async ({ page }) => {
    await openReserveEditor(page, SIZES[0]!);
    const names = async (): Promise<string[]> =>
      page.evaluate(() => (window as any).game.scene.getScene("SquadBuilderScene").reinforcementSetup.openEditorView.reserve.map((e: any) => e.definitionId));
    const before = await names();
    const rowText = (await sceneTexts(page, "SquadBuilderScene")).find((t) => t.startsWith("2  "))!;
    await clickText(page, "SquadBuilderScene", rowText);
    await clickText(page, "SquadBuilderScene", "▲");
    await expect.poll(names).toEqual([before[1], before[0], ...before.slice(2)]);
  });
});

test.describe("Encyclopedia ship detail", () => {
  for (const size of SIZES) {
    test(`every tab at ${size.width}x${size.height}`, async ({ page }) => {
      await openCodex(page, size);
      for (const tab of CODEX_TABS) {
        await clickText(page, "EncyclopediaScene", tab);
        await expect.poll(() => codexTab(page)).toBe(tab.toLowerCase());
        await page.waitForTimeout(250);
        await shot(page, `codex-${tab.toLowerCase()}`, size);
        await expectDense(page, "EncyclopediaScene", size, `codex ${tab}`, MAX_CODEX_TEXTS);
      }
    });
  }

  test("Q / E switch the tabs; typing a search keeps the keys for the field", async ({ page }) => {
    await openCodex(page, SIZES[0]!);
    expect(await codexTab(page)).toBe("overview");
    await page.keyboard.press("e");
    await expect.poll(() => codexTab(page)).toBe("stats");
    await page.keyboard.press("q");
    await expect.poll(() => codexTab(page)).toBe("overview");
    await page.keyboard.type("we");
    const query = await page.evaluate(() => (window as any).game.scene.getScene("EncyclopediaScene").query);
    expect(query).toBe("we");
    expect(await codexTab(page)).toBe("overview");
  });

  test("stats, tags and slots explain themselves with examples", async ({ page }) => {
    await openCodex(page, SIZES[0]!);
    await clickText(page, "EncyclopediaScene", "STATS");
    await expectShortThenFull(page, "EncyclopediaScene", "SPEED", /Speed/, /crosses the arena twice as fast/);
    await page.mouse.move(2, 2);
    await clickText(page, "EncyclopediaScene", "OVERVIEW");
    await page.mouse.move(2, 2);
    await expectShortThenFull(page, "EncyclopediaScene", "43 pt", /Points cost/, /53 pt build/);
  });
});
