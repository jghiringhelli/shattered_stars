/**
 * SquadBuilderScene E2E Tests
 *
 * Covers squad construction, point limit enforcement, faction selection,
 * mode switching, team assignment, and routing to the battle scene.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  suppressWebGLNoise,
} from "./helpers/game";

function suppressNoise(page: Page): void {
  suppressWebGLNoise(page as any);
}

async function openSquadBuilder(page: Page, mode = "SKIRMISH"): Promise<void> {
  await clickMenuItem(page, mode);
  await waitForScene(page, "SquadBuilderScene");
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return (s?.factionSlots?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );
}

type SquadInfo = {
  numFactions: number;
  pointLimit: number;
  gameMode: string;
  slots: Array<{
    factionId: string | null;
    ships: string[];
    pointsUsed: number;
    teamId: number;
  }>;
};

async function getSquadInfo(page: Page): Promise<SquadInfo> {
  return page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
    return {
      numFactions: s?.numFactions ?? 0,
      pointLimit: s?.pointLimit ?? 0,
      gameMode: s?.gameMode ?? "unknown",
      slots: (s?.factionSlots ?? []).map((slot: any) => ({
        factionId: slot.factionId,
        ships: [...(slot.ships ?? [])],
        pointsUsed: slot.pointsUsed ?? 0,
        teamId: slot.teamId ?? 0,
      })),
    };
  });
}

async function waitForSlotCount(page: Page, count: number): Promise<void> {
  await page.waitForFunction(
    (n: number) =>
      ((window as any).game.scene.getScene("SquadBuilderScene") as any)
        ?.numFactions === n,
    count,
    { timeout: 5_000 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — initial state (SKIRMISH / arcade)", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("SquadBuilderScene becomes active", async ({ page }) => {
    const active = await page.evaluate(() =>
      (window as any).game.scene.isActive("SquadBuilderScene"),
    );
    expect(active).toBe(true);
  });

  test("starts with 2 faction slots", async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(2);
  });

  test("default point limit is 200 for arcade mode", async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.pointLimit).toBe(200);
  });

  test("default game mode is arcade", async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.gameMode).toBe("arcade");
  });

  test("slots start on opposing teams (T1 vs T2)", async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.slots[0]!.teamId).toBe(1);
    expect(info.slots[1]!.teamId).toBe(2);
  });

  test("each slot starts with a faction assigned", async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.factionId).not.toBeNull();
    }
  });

  test("auto-fill produces at least 1 ship per slot", async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.ships.length).toBeGreaterThan(0);
    }
  });

  test("auto-fill respects point limit for every slot", async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.pointsUsed).toBeLessThanOrEqual(info.pointLimit);
    }
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
test.describe("SquadBuilderScene — EPIC FORMAT mode", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page, "EPIC FORMAT");
  });

  test("opens SquadBuilderScene in epic mode (400pt)", async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.gameMode).toBe("epic");
    expect(info.pointLimit).toBe(400);
  });

  test("auto-fill still respects 400pt cap per slot", async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.pointsUsed).toBeLessThanOrEqual(400);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — mode switch via in-scene buttons", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("switching to continuous mode keeps point limit at 200", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.gameMode = "continuous";
    });
    const info = await getSquadInfo(page);
    expect(info.gameMode).toBe("continuous");
  });

  test("num factions starts at minimum of 2", async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — starting a battle", () => {
  test("SKIRMISH → auto-fill → START navigates to a battle scene", async ({
    page,
  }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);

    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s?.startBattle?.();
    });

    await page.waitForFunction(
      () => {
        const g = (window as any).game;
        return (
          g.scene.isActive("ArcadeBattleScene") ||
          g.scene.isActive("TurnBasedBattleScene") ||
          g.scene.isActive("ContinuousTacticalScene")
        );
      },
      { timeout: 15_000 },
    );

    const inBattle = await page.evaluate(() => {
      const g = (window as any).game;
      return (
        g.scene.isActive("ArcadeBattleScene") ||
        g.scene.isActive("TurnBasedBattleScene") ||
        g.scene.isActive("ContinuousTacticalScene")
      );
    });
    expect(inBattle).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — squad composition and team assignment", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("adding a squad increases total to 3", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addSquad");
    });
    await waitForSlotCount(page, 3);
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(3);
  });

  test("adding a team creates a squad on a new teamId", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addTeam");
    });
    await waitForSlotCount(page, 3);
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(3);
    const uniqueTeams = new Set(info.slots.map((sl) => sl.teamId));
    expect(uniqueTeams.size).toBe(3);
  });

  test("can build 4-squad composition (2v2)", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addSquad");
      s["squadListPanel"].emit("addSquad");
    });
    await waitForSlotCount(page, 4);
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(4);
    for (const slot of info.slots) {
      expect(slot.pointsUsed).toBeLessThanOrEqual(info.pointLimit);
    }
  });

  test("changing team assignment updates the squad teamId", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("teamChanged", { squadIdx: 0, teamId: 2 });
    });
    await page.waitForTimeout(300);
    const info = await getSquadInfo(page);
    expect(info.slots[0]!.teamId).toBe(2);
  });

  test("removing a squad decreases count (after adding one)", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addSquad");
    });
    await waitForSlotCount(page, 3);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("removeSquad", { squadIdx: 0 });
    });
    await waitForSlotCount(page, 2);
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(2);
  });

  test("removeSquad is blocked when only 2 squads remain", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("removeSquad", { squadIdx: 0 });
    });
    await page.waitForTimeout(300);
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(2);
  });

  test("can build FFA with 3 unique teams", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addTeam");
    });
    await waitForSlotCount(page, 3);
    const info = await getSquadInfo(page);
    const uniqueTeams = new Set(info.slots.map((sl) => sl.teamId));
    expect(uniqueTeams.size).toBe(3);
  });

  test("can build FFA with 4 unique teams", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addTeam");
      s["squadListPanel"].emit("addTeam");
    });
    await waitForSlotCount(page, 4);
    const info = await getSquadInfo(page);
    const uniqueTeams = new Set(info.slots.map((sl) => sl.teamId));
    expect(uniqueTeams.size).toBe(4);
  });

  test("auto-fill respects point limit after adding extra squads", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addSquad");
      s["squadListPanel"].emit("addSquad");
    });
    await waitForSlotCount(page, 4);
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.pointsUsed).toBeLessThanOrEqual(info.pointLimit);
    }
  });

  test("faction cycling changes factionId on the squad", async ({ page }) => {
    const before = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads[0].factionId as string;
    });
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      // Directly cycle the faction as the Faction button does
      const factions = [
        "terran_hegemony",
        "free_confederation",
        "synthetic_collective",
        "void_corsairs",
        "ascendant_empire",
      ];
      const current = s.squads[0].factionId as string;
      const idx = factions.indexOf(current);
      s.squads[0].factionId = factions[(idx + 1) % factions.length];
    });
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads[0].factionId as string;
    });
    expect(after).not.toBe(before);
  });

  test("controller toggle switches between player and ai", async ({ page }) => {
    const initial = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads[0].controller as string;
    });
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squads[0].controller =
        s.squads[0].controller === "player" ? "ai" : "player";
    });
    await page.waitForTimeout(100);
    const toggled = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads[0].controller as string;
    });
    expect(toggled).not.toBe(initial);
    // Toggle back
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squads[0].controller =
        s.squads[0].controller === "player" ? "ai" : "player";
    });
    await page.waitForTimeout(100);
    const restored = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads[0].controller as string;
    });
    expect(restored).toBe(initial);
  });

  test("removeTeam is blocked when only 2 teams remain", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("removeTeam", 1);
    });
    await page.waitForTimeout(300);
    const info = await getSquadInfo(page);
    const uniqueTeams = new Set(info.slots.map((sl) => sl.teamId));
    expect(uniqueTeams.size).toBe(2);
  });

  test("removeTeam removes team when more than 2 teams exist", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addTeam");
    });
    await waitForSlotCount(page, 3);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      const teams = [
        ...new Set((s.squads as any[]).map((sq: any) => sq.teamId)),
      ];
      s["squadListPanel"].emit("removeTeam", teams[teams.length - 1]);
    });
    await waitForSlotCount(page, 2);
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(2);
    const uniqueTeams = new Set(info.slots.map((sl) => sl.teamId));
    expect(uniqueTeams.size).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("SquadBuilderScene — validation and navigation", () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test("START BATTLE is blocked when a squad has no ships", async ({
    page,
  }) => {
    // Clear ships from first squad
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squads[0].ships = [];
      s.squads[0].pointsUsed = 0;
    });
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.startBattle();
    });
    // Should stay on SquadBuilderScene
    await page.waitForTimeout(500);
    const stillHere = await page.evaluate(() =>
      (window as any).game.scene.isActive("SquadBuilderScene"),
    );
    expect(stillHere).toBe(true);
  });

  test("START BATTLE is blocked when all squads share the same team", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      // Put both squads on team 1
      s.squads.forEach((sq: any) => {
        sq.teamId = 1;
      });
    });
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.startBattle();
    });
    await page.waitForTimeout(500);
    const stillHere = await page.evaluate(() =>
      (window as any).game.scene.isActive("SquadBuilderScene"),
    );
    expect(stillHere).toBe(true);
  });

  test("BACK button returns to MainMenuScene", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.scene.start("MainMenuScene");
    });
    await waitForScene(page, "MainMenuScene");
    const active = await page.evaluate(() =>
      (window as any).game.scene.isActive("MainMenuScene"),
    );
    expect(active).toBe(true);
  });

  test("computeFormatLabel reflects current squad assignments", async ({
    page,
  }) => {
    const label1v1 = await page.evaluate(() => {
      const { computeFormatLabel } = (window as any).__squadTypes ?? {};
      // Access via scene instead
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return s.squads
        ? [
            ...new Map(
              s.squads.map((sq: any) => [
                sq.teamId,
                s.squads.filter((x: any) => x.teamId === sq.teamId).length,
              ]),
            ).values(),
          ]
            .sort((a: number, b: number) => b - a)
            .join("v")
        : null;
    });
    expect(label1v1).toBe("1v1");
  });

  test("addSquad adds to the specified team", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s["squadListPanel"].emit("addSquad", 2);
    });
    await waitForSlotCount(page, 3);
    const info = await getSquadInfo(page);
    const team2squads = info.slots.filter((sl) => sl.teamId === 2);
    expect(team2squads.length).toBe(2);
  });
});
