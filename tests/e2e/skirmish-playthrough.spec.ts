/**
 * skirmish-playthrough.spec.ts
 *
 * End-to-end play of Skirmish mode. Screenshots each stage, records telemetry,
 * verifies squad builder + battle state, and reports timing.
 *
 * Screenshots land in tests/e2e/screenshots/playthrough/*.png
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  suppressWebGLNoise,
  readShipTelemetry,
} from "./helpers/game";

const SHOTS_DIR = "tests/e2e/screenshots/playthrough";
const REPORT_PATH = path.join(SHOTS_DIR, "REPORT.md");

function shot(page: Page, name: string): Promise<Buffer> {
  return page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

async function readRegistry(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (k: string) => (window as any).game?.registry?.get(k) ?? null,
    key,
  );
}

async function readSquadBuilderState(page: Page): Promise<{
  squadCount: number;
  factions: string[];
  controllers: string[];
  shipCounts: number[];
  pointsUsed: number[];
  pointLimit: number;
  gameMode: string;
}> {
  return page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
    return {
      squadCount: s.squads.length,
      factions: s.squads.map((q: any) => q.factionId),
      controllers: s.squads.map((q: any) => q.controller),
      shipCounts: s.squads.map((q: any) => q.ships.length),
      pointsUsed: s.squads.map((q: any) => q.pointsUsed),
      pointLimit: s.pointLimit,
      gameMode: s.gameMode,
    };
  });
}

async function readBattleState(
  page: Page,
  sceneKey: string,
): Promise<{
  shipCount: number;
  ships: Array<{
    id: string;
    owner: string;
    faction: string;
    hull: number;
    maxHull: number;
    shields: number;
    x: number;
    y: number;
  }>;
  playerShipIds: string[];
  enemyShipIds: string[];
  turn?: number;
  isPaused?: boolean;
}> {
  return page.evaluate((key: string) => {
    const scene = (window as any).game.scene.getScene(key) as any;
    if (!scene)
      return {
        shipCount: 0,
        ships: [],
        playerShipIds: [],
        enemyShipIds: [],
      };
    const ships: any[] = [];
    if (scene.ships && typeof scene.ships.forEach === "function") {
      scene.ships.forEach((s: any) => {
        ships.push({
          id: s.id,
          owner: s.owner,
          faction: s.faction,
          hull: s.hull ?? 0,
          maxHull: s.maxHull ?? 0,
          shields: s.shields ?? 0,
          x: Math.round(s.x ?? 0),
          y: Math.round(s.y ?? 0),
        });
      });
    }
    return {
      shipCount: ships.length,
      ships,
      playerShipIds: [...(scene.playerShipIds ?? [])],
      enemyShipIds: [...(scene.enemyShipIds ?? [])],
      turn: scene.currentTurn ?? scene.turn ?? undefined,
      isPaused: scene.isPaused,
    };
  }, sceneKey);
}

test.describe("Skirmish playthrough — full run with screenshots + telemetry", () => {
  test.setTimeout(180_000);

  test("plays Skirmish from menu to combat, records state at each step", async ({
    page,
  }) => {
    if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

    // ─── Setup: capture console errors, enable telemetry ────────────────────
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (
          t.includes("WebGL") ||
          t.includes("Framebuffer") ||
          t.includes("favicon") ||
          t.includes("WebSocket") ||
          t.includes("Failed to process file")
        )
          return;
        consoleErrors.push(t);
      }
    });
    suppressWebGLNoise(page);

    const report: string[] = ["# Skirmish Playthrough Report\n"];
    const stamp = (label: string): void => {
      report.push(`- **${label}**: t=${Date.now() - t0}ms`);
    };
    const t0 = Date.now();

    // ─── Stage 1: Main menu ─────────────────────────────────────────────────
    await page.goto("/?debug=1");
    await waitForMenuReady(page);
    await shot(page, "01_main_menu");
    stamp("Main menu ready");

    const menuItemCount = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("MainMenuScene") as any;
      return s?.menuItems?.length ?? 0;
    });
    report.push(`- Menu items visible: **${menuItemCount}**`);
    expect(menuItemCount).toBe(11);

    // ─── Stage 2: Squad builder ─────────────────────────────────────────────
    await clickMenuItem(page, "SKIRMISH");
    await waitForScene(page, "SquadBuilderScene");
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene(
          "SquadBuilderScene",
        ) as any;
        return (s?.factionSlots?.length ?? 0) > 0;
      },
      { timeout: 10_000 },
    );
    // Let layout settle a beat
    await page.waitForTimeout(200);
    // This test exercises the advanced multi-squad auto-fill flow — arcade
    // mode now defaults to the simple single-ship flow, so switch out of it.
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      if (s?.simpleMode) {
        s.simpleMode = false;
        s.renderBuilderMode();
      }
    });
    await shot(page, "02_squad_builder_initial");
    stamp("Squad builder opened");

    const sbInitial = await readSquadBuilderState(page);
    report.push(
      `- Squad builder initial: **${sbInitial.squadCount} squads**, mode=**${sbInitial.gameMode}**, pointLimit=**${sbInitial.pointLimit}**`,
    );
    report.push(`  - Factions preset: ${sbInitial.factions.join(", ")}`);
    report.push(`  - Controllers: ${sbInitial.controllers.join(", ")}`);
    expect(sbInitial.squadCount).toBeGreaterThanOrEqual(2);
    expect(sbInitial.gameMode).toBe("arcade");
    expect(sbInitial.pointLimit).toBe(200);

    // ─── Stage 3: Auto-fill both squads ─────────────────────────────────────
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      s.squadListPanel.autoFillAll();
    });
    await page.waitForTimeout(300);
    await shot(page, "03_squad_builder_autofilled");
    stamp("Auto-fill applied");

    const sbFilled = await readSquadBuilderState(page);
    report.push(
      `- Squad builder after auto-fill: ships=${sbFilled.shipCounts.join("/")}, points=${sbFilled.pointsUsed.join("/")}`,
    );
    for (let i = 0; i < sbFilled.squadCount; i++) {
      expect(sbFilled.shipCounts[i]).toBeGreaterThan(0);
      expect(sbFilled.pointsUsed[i]).toBeGreaterThan(0);
      expect(sbFilled.pointsUsed[i]).toBeLessThanOrEqual(sbFilled.pointLimit);
    }

    // ─── Stage 4: Start battle ──────────────────────────────────────────────
    await page.evaluate(() => {
      (window as any).game.scene.getScene("SquadBuilderScene")?.startBattle();
    });

    // Skirmish = arcade → ArcadeBattleScene (real-time flight)
    await waitForScene(page, "ArcadeBattleScene", 15_000);
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene(
          "ArcadeBattleScene",
        ) as any;
        return (s?.ships?.size ?? 0) > 0 && s?.playerShipId != null;
      },
      { timeout: 15_000 },
    );
    await page.waitForTimeout(500);
    await shot(page, "04_battle_initial");
    stamp("Battle started (ArcadeBattleScene)");

    const b0 = await readBattleState(page, "ArcadeBattleScene");
    report.push(
      `- Battle initial: **${b0.shipCount} ships** (player=${b0.playerShipIds.length}, enemy=${b0.enemyShipIds.length})`,
    );
    for (const s of b0.ships) {
      report.push(
        `  - ${s.id} [${s.owner}/${s.faction}] hull=${s.hull}/${s.maxHull} pos=(${s.x},${s.y})`,
      );
    }
    expect(b0.shipCount).toBeGreaterThanOrEqual(4);

    // ─── Stage 5: Play — hold ArrowUp + fire while combat runs ──────────────
    // ArcadeBattleScene has real-time keyboard input. Simulate a pilot who
    // holds forward + occasionally strafes + fires SPACE.
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1000);
    await page.keyboard.down("Space");
    await page.waitForTimeout(1000);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(2000);
    await page.keyboard.up("ArrowRight");
    await shot(page, "05_battle_mid");
    stamp("Mid-battle (4s in, holding forward+fire)");

    const bMid = await readBattleState(page, "ArcadeBattleScene");
    const midHulls = bMid.ships.map((s) => s.hull);
    const startHulls = b0.ships.map((s) => s.hull);
    const anyDamage = bMid.ships.some(
      (s, i) => (s.hull ?? 0) < (startHulls[i] ?? 0),
    );
    report.push(
      `- Mid-battle hulls: ${midHulls.join("/")}${anyDamage ? " (combat resolving ✓)" : " (no damage yet)"}`,
    );

    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(2000);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.up("Space");
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(2000);
    await shot(page, "06_battle_later");
    stamp("Later battle (8s in)");

    // ─── Stage 6: Telemetry sanity ──────────────────────────────────────────
    const samples = await readShipTelemetry(page);
    report.push(`- Telemetry samples captured: **${samples.length}**`);
    if (samples.length > 0) {
      const perShip = new Map<string, typeof samples>();
      for (const s of samples) {
        if (!perShip.has(s.shipId)) perShip.set(s.shipId, []);
        perShip.get(s.shipId)!.push(s);
      }
      report.push(`- Ships with telemetry: **${perShip.size}**`);
      let anyMoved = false;
      const tSpans: number[] = [];
      for (const [id, arr] of perShip) {
        if (arr.length < 2) continue;
        const first = arr[0]!;
        const last = arr[arr.length - 1]!;
        const dist = Math.hypot(last.x - first.x, last.y - first.y);
        const dt = last.t - first.t;
        tSpans.push(dt);
        if (dist > 5) anyMoved = true;
        report.push(
          `  - ${id}: ${arr.length} samples, span=${dt.toFixed(0)}ms, moved ${dist.toFixed(1)}px`,
        );
      }
      const avgSpan = tSpans.reduce((a, b) => a + b, 0) / (tSpans.length || 1);
      report.push(
        `- Avg telemetry span: **${avgSpan.toFixed(0)}ms** (playthrough was ~8000ms)`,
      );
      report.push(`- Any ship moved: **${anyMoved ? "yes ✓" : "no ✗"}**`);
      // Timestamps should be monotonically non-decreasing
      const firstShipSamples = perShip.values().next().value as typeof samples;
      if (firstShipSamples && firstShipSamples.length > 1) {
        const monotonic = firstShipSamples.every(
          (s, i) => i === 0 || s.t >= firstShipSamples[i - 1]!.t,
        );
        report.push(
          `- Timestamps monotonic: **${monotonic ? "yes ✓" : "no ✗"}**`,
        );
        expect(monotonic).toBe(true);
      }
    }

    // ─── Stage 7: Wait a bit more, then final snapshot ──────────────────────
    await page.waitForTimeout(3_000);
    await shot(page, "07_battle_final");
    stamp("Final snapshot (11s in)");

    const bFinal = await readBattleState(page, "ArcadeBattleScene");
    const alivePlayer = bFinal.ships.filter(
      (s) => s.owner === "player" && s.hull > 0,
    ).length;
    const aliveEnemy = bFinal.ships.filter(
      (s) => s.owner === "ai" && s.hull > 0,
    ).length;
    report.push(
      `- Final: player alive=**${alivePlayer}**, enemy alive=**${aliveEnemy}**`,
    );
    for (const s of bFinal.ships) {
      report.push(
        `  - ${s.id} [${s.owner}/${s.faction}] hull=${s.hull}/${s.maxHull} pos=(${s.x.toFixed(0)},${s.y.toFixed(0)})`,
      );
    }

    // ─── Stage 8: Error report ──────────────────────────────────────────────
    report.push(`\n## Errors`);
    report.push(`- Page errors: **${pageErrors.length}**`);
    report.push(`- Console errors: **${consoleErrors.length}**`);
    if (pageErrors.length) report.push(`  - ${pageErrors.join("\n  - ")}`);
    if (consoleErrors.length)
      report.push(`  - ${consoleErrors.join("\n  - ")}`);

    fs.writeFileSync(REPORT_PATH, report.join("\n") + "\n");

    expect(pageErrors).toEqual([]);
    // Console errors we tolerate none in gameplay path
    expect(consoleErrors).toEqual([]);
  });
});
