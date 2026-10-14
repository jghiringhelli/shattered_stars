/**
 * pick-screens-campaign.spec.ts — the campaign hub's tabbed panels (Armory,
 * Research, hero card, squad): ONE tab open at a time, tabs switch with the
 * mouse and Q / E, every row explains itself on hover (short, then full on
 * hold), text density and minimum font size, and screenshots of every tab at
 * 1280x720 and 1920x1080 (to $TEMP).
 */

import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect, type Page } from "@playwright/test";
import {
  BATTLE,
  launchCampaignMission,
  openCampaignHub,
} from "./helpers/campaignEntry";
import {
  clickText,
  hoverText,
  tooltip,
  tooltipExpanded,
  visibleTexts,
} from "./helpers/pickScreens";

const HUB = "CampaignScene";
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
/** Text elements of a whole hub screen (header, hub tabs, panels) at most. */
const MAX_TEXTS = 40;
/** Smallest readable font at 1280x720 (px). */
const MIN_FONT = 12;

const SAVE = { credits: 500, researchPoints: 3, totalXp: 120, totalKills: 7 };

type Panel = "main" | "hero" | "squad";

async function openHub(page: Page, tab?: string): Promise<void> {
  await openCampaignHub(page, "free_confederation", SAVE);
  await page.evaluate(
    async ({ k, f }) => {
      const { CampaignSaveManager } = await import("/src/systems/CampaignSaveManager.ts");
      const { initializePilots } = await import("/src/systems/CampaignPilotManager.ts");
      const save = CampaignSaveManager.load(f as any)!;
      CampaignSaveManager.save({ ...save, campaignPilots: initializePilots(f as any) });
      (window as any).game.scene.getScene(k).selectFaction(f);
    },
    { k: HUB, f: "free_confederation" },
  );
  if (tab) {
    await page.evaluate(
      ({ k, t }) => (window as any).game.scene.getScene(k).selectHubTab(t),
      { k: HUB, t: tab },
    );
  }
  await page.waitForTimeout(150);
}

async function openPanelTab(page: Page, panel: Panel, tab: string): Promise<void> {
  await page.evaluate(
    ({ k, p, t }) => (window as any).game.scene.getScene(k).openPanelTab(p, t),
    { k: HUB, p: panel, t: tab },
  );
  await page.mouse.move(2, 2);
  await page.waitForTimeout(150);
}

async function tabOf(page: Page, panel: Panel): Promise<string> {
  return page.evaluate(
    ({ k, p }) => (window as any).game.scene.getScene(k).panelTabs().tabOf(p),
    { k: HUB, p: panel },
  );
}

/** The campaign line also shown in the scene header: hover the LAST match (the card). */
const CAST = "Cdr. Aria Santos (Libre One), Phoenix One, Doc Vasquez";
const STORY =
  "A deserter learns what freedom costs, liberates Halden, and answers the enemy's ceasefire. Lead the cells from the Nest to the last gate.";

async function hoverLastText(page: Page, text: string): Promise<void> {
  const point = await page.evaluate(
    ({ k, t }) => {
      const scene = (window as any).game.scene.getScene(k);
      let hit: any = null;
      const walk = (list: any[]): void =>
        list.forEach((obj) => {
          if (obj.text === t) hit = obj;
          walk(obj.list ?? []);
        });
      walk(scene.children.list);
      const b = hit.getBounds();
      const g = (window as any).game;
      return { x: b.centerX, y: b.centerY, w: g.scale.gameSize.width, h: g.scale.gameSize.height };
    },
    { k: HUB, t: text },
  );
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(
    box.x + point.x * (box.width / point.w),
    box.y + point.y * (box.height / point.h),
  );
}

const shot = (name: string, size: { width: number; height: number }): string =>
  join(tmpdir(), `pick-campaign-${name}-${size.width}x${size.height}.png`);

const SCREENS: ReadonlyArray<{
  name: string;
  hub: string;
  panel: Panel;
  tabs: readonly string[];
}> = [
  { name: "armory", hub: "armory", panel: "main", tabs: ["overview", "effects", "cost"] },
  { name: "research", hub: "research", panel: "main", tabs: ["overview", "effects", "cost"] },
  { name: "hero", hub: "armory", panel: "hero", tabs: ["overview", "effects", "lore"] },
  { name: "squad", hub: "armory", panel: "squad", tabs: ["overview", "stats", "loadout", "pilot"] },
];

test.describe("Campaign hub — tabbed panels", () => {
  for (const size of SIZES) {
    test(`screenshots of every tab at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const screen of SCREENS) {
        await openHub(page, screen.hub);
        for (const tab of screen.tabs) {
          await openPanelTab(page, screen.panel, tab);
          expect(await tabOf(page, screen.panel)).toBe(tab);
          await page.screenshot({ path: shot(`${screen.name}-${tab}`, size) });
        }
      }
    });
  }

  test("every tab keeps the screen light and readable at 1280x720", async ({ page }) => {
    await page.setViewportSize(SIZES[0]);
    const counts: string[] = [];
    for (const screen of SCREENS) {
      await openHub(page, screen.hub);
      for (const tab of screen.tabs) {
        await openPanelTab(page, screen.panel, tab);
        const texts = await visibleTexts(page, HUB);
        counts.push(`${screen.name}/${tab}: ${texts.length}`);
        expect(
          texts.length,
          `${screen.name}/${tab}: ${texts.map((t) => t.text.replace(/\n/g, "/")).join(" | ")}`,
        ).toBeLessThanOrEqual(MAX_TEXTS);
        const small = texts.filter((t) => t.size < MIN_FONT);
        expect(small, `${screen.name}/${tab} small texts`).toEqual([]);
      }
    }
    console.log(`TEXT COUNTS ${counts.join(" | ")}`);
  });

  test("tabs switch with the mouse and with Q / E on the active panel", async ({ page }) => {
    await openHub(page, "armory");
    expect(await tabOf(page, "main")).toBe("overview");
    await clickText(page, HUB, "EFFECTS");
    await expect.poll(() => tabOf(page, "main")).toBe("effects");
    await page.mouse.move(2, 2);
    await page.keyboard.press("e");
    await expect.poll(() => tabOf(page, "main")).toBe("cost");
    await page.keyboard.press("q");
    await page.keyboard.press("q");
    await expect.poll(() => tabOf(page, "main")).toBe("overview");
    expect(await tabOf(page, "hero")).toBe("overview");
  });

  test("Q / E drive the panel the player touched last", async ({ page }) => {
    await openHub(page, "missions");
    await openPanelTab(page, "squad", "stats");
    await page.keyboard.press("e");
    await expect.poll(() => tabOf(page, "squad")).toBe("loadout");
    expect(await tabOf(page, "hero")).toBe("overview");
  });

  test("the selected tab is remembered when the hub is rebuilt", async ({ page }) => {
    await openHub(page, "research");
    await openPanelTab(page, "main", "cost");
    await page.evaluate(
      (k) => (window as any).game.scene.getScene(k).selectHubTab("missions"),
      HUB,
    );
    await page.evaluate(
      (k) => (window as any).game.scene.getScene(k).selectHubTab("research"),
      HUB,
    );
    expect(await tabOf(page, "main")).toBe("cost");
  });
});

test.describe("Campaign hub — explanations", () => {
  async function expectTip(
    page: Page,
    text: string,
    short: string,
    full: string,
  ): Promise<void> {
    await hoverText(page, HUB, text);
    await expect.poll(() => tooltip(page, HUB)).toContain(short);
    expect(await tooltipExpanded(page, HUB)).toBe(false);
    await expect.poll(() => tooltipExpanded(page, HUB), { timeout: 4000 }).toBe(true);
    expect(await tooltip(page, HUB)).toContain(full);
    await page.mouse.move(2, 2);
  }

  test("an armory mod explains itself short, then in full with an example", async ({ page }) => {
    await openHub(page, "armory");
    await expectTip(page, "Capacitor Array", "Capacitor Array", "Click to install it for 150 credits");
    await openPanelTab(page, "main", "effects");
    await expectTip(
      page,
      "Capacitor Array \u2014 +25% shields on every ship of your squad.",
      "Capacitor Array",
      "a fighter with 12 shields now carries 15",
    );
    await openPanelTab(page, "main", "cost");
    await expectTip(
      page,
      "Capacitor Array \u2014 150 CR \u00b7 AFFORDABLE",
      "Capacitor Array",
      "refunded in full",
    );
  });

  test("the armory slot caption explains the slot", async ({ page }) => {
    await openHub(page, "armory");
    await expectTip(page, "SHIELDS", "Shields slot", "Capacitor Array (+25% shields)");
  });

  test("a research option explains its lock and its permanence", async ({ page }) => {
    await openHub(page, "research");
    await expectTip(page, "Reactive Plating", "Reactive Plating", "Click once to mark it");
    await expectTip(
      page,
      "COMMAND DOCTRINE \u00b7 LOCKED (6 POINTS)",
      "Command Doctrine",
      "Hero Conduit recharges hero powers 20% faster",
    );
  });

  test("the hero card explains a power, its ranks and the campaign cast", async ({ page }) => {
    await openHub(page, "armory");
    await expectTip(page, "LIBRE ONE", "Hero", "carries the two hero powers");
    await expectTip(
      page,
      "[V]  \u2691  RALLY THE FLEET \u00b7 RANK I",
      "Rally the Fleet",
      "Cast with V (gamepad Y)",
    );
    await openPanelTab(page, "hero", "effects");
    await expectTip(
      page,
      [
        "I \u00b7 35 s \u00b7 8 s \u00b7 -30% fire interval",
        "II \u00b7 30 s \u00b7 8 s \u00b7 -35% fire interval",
        "III \u00b7 25 s \u00b7 9 s \u00b7 -40% fire interval",
      ].join("\n"),
      "Power rank",
      "rank III deals 50 damage",
    );
    await openPanelTab(page, "hero", "lore");
    await expectTip(page, STORY, "Hero story", "Omega-7 starts as a unit");
    await hoverLastText(page, CAST);
    await expect.poll(() => tooltip(page, HUB)).toContain("Campaign cast");
    await expect.poll(() => tooltipExpanded(page, HUB), { timeout: 4000 }).toBe(true);
    expect(await tooltip(page, HUB)).toContain("Terran Hegemony: Cadet to Admiral");
  });

  test("the squad panel explains totals, the roster and a pilot's stats", async ({ page }) => {
    await openHub(page, "armory");
    await expectTip(page, "120 XP", "Experience", "A pilot reaches skill 2 at 100 XP");
    await expectTip(page, "500 CR", "Credits", "Capacitor Array (150)");
    await expectTip(page, "LIBRE ONE \u00b7 SKILL 1", "Squad pilot", "stays selected");
    await openPanelTab(page, "squad", "stats");
    await expectTip(page, "HULL 3", "Hull", "");
    await openPanelTab(page, "squad", "pilot");
    await expectTip(page, "SKILL 1 / 6", "Pilot skill", "Skill comes only from XP");
  });
});

test.describe("Hero power bar (battle HUD)", () => {
  test("hovering a power slot explains the power and its key", async ({ page }) => {
    await launchCampaignMission(page, {
      factionId: "terran_hegemony",
      missionId: "heg_1_3",
      noCombat: true,
      noScript: true,
      noObjectives: true,
    });
    const slot = await page.evaluate(() => {
      const g = (window as any).game;
      return { x: 44, y: g.scale.gameSize.height - 16 - 30 - 28, w: g.scale.gameSize.width, h: g.scale.gameSize.height };
    });
    const box = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(
      box.x + slot.x * (box.width / slot.w),
      box.y + slot.y * (box.height / slot.h),
    );
    await expect.poll(() => tooltip(page, BATTLE)).toContain("Orbital Strike");
    await expect.poll(() => tooltipExpanded(page, BATTLE), { timeout: 4000 }).toBe(true);
    expect(await tooltip(page, BATTLE)).toContain("Cast with V (gamepad Y)");
  });
});
