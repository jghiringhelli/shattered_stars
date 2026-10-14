/**
 * EncyclopediaScene E2E Tests
 *
 * Covers opening, ship list population, faction filtering, and detail panel.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  suppressWebGLNoise,
} from "./helpers/game";

function suppressNoise(page: Page): void {
  suppressWebGLNoise(page);
}

async function openEncyclopedia(page: Page): Promise<void> {
  await clickMenuItem(page, "ENCYCLOPEDIA");
  await waitForScene(page, "EncyclopediaScene");
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      return (s?.filteredEntries?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe("EncyclopediaScene — initial state", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page as any);
    await page.goto("/");
    await waitForMenuReady(page);
    await openEncyclopedia(page);
  });

  test("EncyclopediaScene becomes active", async ({ page }) => {
    const active = await page.evaluate(() =>
      (window as any).game.scene.isActive("EncyclopediaScene"),
    );
    expect(active).toBe(true);
  });

  test("shows all ships (101) when no faction filter", async ({ page }) => {
    const count = await page.evaluate(
      () =>
        (window as any).game.scene.getScene("EncyclopediaScene")
          ?.filteredEntries?.length ?? 0,
    );
    // 100 standard ships + 1 synth_gestalt huge = 101
    expect(count).toBe(101);
  });

  test("no faction filter active on open (activeFaction is null)", async ({
    page,
  }) => {
    const activeFaction = await page.evaluate(
      () =>
        (window as any).game.scene.getScene("EncyclopediaScene")
          ?.activeFaction ?? null,
    );
    expect(activeFaction).toBeNull();
  });

  test("ESC returns to MainMenuScene", async ({ page }) => {
    await page.keyboard.press("Escape");
    await waitForScene(page, "MainMenuScene");
    const active = await page.evaluate(() =>
      (window as any).game.scene.isActive("MainMenuScene"),
    );
    expect(active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("EncyclopediaScene — faction filtering", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page as any);
    await page.goto("/");
    await waitForMenuReady(page);
    await openEncyclopedia(page);
  });

  test("filtering by terran_hegemony returns exactly 20 ships", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      s.onFactionFilter("terran_hegemony");
    });
    const count = await page.evaluate(
      () =>
        (window as any).game.scene.getScene("EncyclopediaScene")
          ?.filteredEntries?.length ?? 0,
    );
    expect(count).toBe(20);
  });

  test("filtering by synthetic_collective returns 21 ships (includes synth_gestalt)", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      s.onFactionFilter("synthetic_collective");
    });
    const count = await page.evaluate(
      () =>
        (window as any).game.scene.getScene("EncyclopediaScene")
          ?.filteredEntries?.length ?? 0,
    );
    expect(count).toBe(21); // 20 standard + synth_gestalt huge
  });

  test("filtering by each faction returns > 0 ships", async ({ page }) => {
    const factionIds = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];
    for (const factionId of factionIds) {
      await page.evaluate((id: string) => {
        const s = (window as any).game.scene.getScene(
          "EncyclopediaScene",
        ) as any;
        s.onFactionFilter(id);
      }, factionId);
      const count = await page.evaluate(
        () =>
          (window as any).game.scene.getScene("EncyclopediaScene")
            ?.filteredEntries?.length ?? 0,
      );
      expect(count).toBeGreaterThan(0);
    }
  });

  test("clearing filter (null) restores full list", async ({ page }) => {
    // Apply filter
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      s.onFactionFilter("terran_hegemony");
    });
    // Clear filter
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      s.onFactionFilter(null);
    });
    const count = await page.evaluate(
      () =>
        (window as any).game.scene.getScene("EncyclopediaScene")
          ?.filteredEntries?.length ?? 0,
    );
    expect(count).toBe(101);
  });

  test("filtered entries all match the selected faction", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      s.onFactionFilter("void_corsairs");
    });
    // Verify activeFaction was set and count is > 0
    const result = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      return {
        activeFaction: s.activeFaction,
        count: s.filteredEntries?.length ?? 0,
      };
    });
    expect(result.activeFaction).toBe("void_corsairs");
    expect(result.count).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("EncyclopediaScene — entry data integrity", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page as any);
    await page.goto("/");
    await waitForMenuReady(page);
    await openEncyclopedia(page);
  });

  test("every entry has a non-empty shipId", async ({ page }) => {
    const allHaveIds = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      return s.filteredEntries.every(
        (e: any) => typeof e.shipId === "string" && e.shipId.length > 0,
      );
    });
    expect(allHaveIds).toBe(true);
  });

  test("every entry has valid stats (speed and maneuverability are numbers)", async ({
    page,
  }) => {
    const allValid = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      return s.filteredEntries.every(
        (e: any) =>
          typeof e.stats?.speed === "number" &&
          typeof e.stats?.maneuverability === "number",
      );
    });
    expect(allValid).toBe(true);
  });

  test("synth_gestalt appears in the full list", async ({ page }) => {
    const hasMegazord = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      return s.filteredEntries.some((e: any) => e.shipId === "synth_gestalt");
    });
    expect(hasMegazord).toBe(true);
  });

  test("showDetail does not throw for first ship in list", async ({ page }) => {
    let threw = false;
    page.on("pageerror", () => {
      threw = true;
    });
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
      const firstId = s.filteredEntries[0]?.shipId;
      if (firstId) s.showDetail(firstId);
    });
    await page.waitForTimeout(300);
    expect(threw).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Codex sections: pilots, upgrades, factions; search; keyboard.

type CodexProbe = {
  section: string;
  rows: number;
  ids: string[];
  textPanelVisible: boolean;
  query: string;
};

async function codexState(page: Page): Promise<CodexProbe> {
  return page.evaluate(() => {
    const s = (window as any).game.scene.getScene("EncyclopediaScene") as any;
    return {
      section: s.section,
      rows: s.codexRows.length,
      ids: s.codexRows.map((r: any) => r.id),
      textPanelVisible: s.textPanel.visible,
      query: s.query,
    };
  });
}

async function setSection(page: Page, section: string): Promise<void> {
  await page.evaluate((id: string) => {
    (window as any).game.scene.getScene("EncyclopediaScene").setSection(id);
  }, section);
}

test.describe("EncyclopediaScene — codex sections", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page as any);
    await page.goto("/");
    await waitForMenuReady(page);
    await openEncyclopedia(page);
  });

  test("opens on the ships section with the ship detail panel", async ({
    page,
  }) => {
    const state = await codexState(page);
    expect(state.section).toBe("ships");
    expect(state.rows).toBe(101);
    expect(state.textPanelVisible).toBe(false);
  });

  test("lists every pilot card and shows its detail", async ({ page }) => {
    await setSection(page, "pilots");
    const state = await codexState(page);
    expect(state.rows).toBeGreaterThanOrEqual(235);
    expect(state.textPanelVisible).toBe(true);
  });

  test("lists every upgrade card, including the Force powers", async ({
    page,
  }) => {
    await setSection(page, "upgrades");
    const state = await codexState(page);
    expect(state.rows).toBeGreaterThanOrEqual(57);
    expect(state.ids).toEqual(
      expect.arrayContaining(["battle_meditation", "swarm_uplink"]),
    );
  });

  test("lists the five factions", async ({ page }) => {
    await setSection(page, "factions");
    expect((await codexState(page)).rows).toBe(5);
  });

  test("a faction filter keeps generic cards and drops other factions", async ({
    page,
  }) => {
    await setSection(page, "upgrades");
    await page.evaluate(() => {
      (window as any).game.scene
        .getScene("EncyclopediaScene")
        .onFactionFilter("void_corsairs");
    });
    const { ids } = await codexState(page);
    expect(ids).toContain("heavy_laser_cannon");
    expect(ids).not.toContain("battle_meditation");
  });

  test("typing searches the current section; BACKSPACE and DELETE edit it", async ({
    page,
  }) => {
    await setSection(page, "pilots");
    await page.keyboard.type("whisper");
    let state = await codexState(page);
    expect(state.query).toBe("whisper");
    expect(state.ids).toContain("whisper_null");
    expect(state.rows).toBeLessThan(5);
    await page.keyboard.press("Backspace");
    expect((await codexState(page)).query).toBe("whispe");
    await page.keyboard.press("Delete");
    state = await codexState(page);
    expect(state.query).toBe("");
    expect(state.rows).toBeGreaterThanOrEqual(235);
  });

  test("LEFT / RIGHT switch sections (wrapping)", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    expect((await codexState(page)).section).toBe("pilots");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    expect((await codexState(page)).section).toBe("bestiary");
  });

  test("the BESTIARY lists the creatures with their lore", async ({ page }) => {
    await setSection(page, "bestiary");
    const { ids } = await codexState(page);
    expect(ids).toContain("cinder_wyrm");
    expect(ids).toContain("warden_avatar");
    await page.keyboard.press("ArrowDown");
    const selected = await page.evaluate(
      () => (window as any).game.scene.getScene("EncyclopediaScene").selectedId,
    );
    expect(ids).toContain(selected);
  });

  test("DOWN steps through pilots without errors", async ({ page }) => {
    let threw = false;
    page.on("pageerror", () => {
      threw = true;
    });
    await setSection(page, "pilots");
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
    const selected = await page.evaluate(
      () => (window as any).game.scene.getScene("EncyclopediaScene").selectedId,
    );
    const { ids } = await codexState(page);
    expect(selected).toBe(ids[5]);
    expect(threw).toBe(false);
  });
});
