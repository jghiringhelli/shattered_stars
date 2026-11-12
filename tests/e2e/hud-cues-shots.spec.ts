/**
 * hud-cues-shots.spec.ts — owner screenshot run for the maneuver cue and the
 * firing cue (Skirmish). Not an assertion suite: it forces each state through
 * the HUD snapshot and saves one PNG per state under test-results/hud-cues/.
 *
 * Forcing wraps ArcadeBattleHud's BattleHud.update (dev build, `?debug=1`):
 * the real snapshot is rewritten before the HUD draws it, so the cues run
 * through the production code. Dashes get a one-frame pose jump so the
 * afterimages and streak have a displacement to follow.
 *
 * Run: npx playwright test tests/e2e/hud-cues-shots.spec.ts
 */

import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { SKIRMISH } from "./helpers/battleEntry";

const OUT_DIR = "test-results/hud-cues";
/** Heavy fighter: weaponRange 250 px, firingArc 75 deg. */
const WEAPON_RANGE_PX = 250;
const FIRING_ARC_DEG = 75;
/** The cue lasts 1 s; wait this long so the previous one is gone. */
const CUE_GONE_MS = 1300;
/** Into the hold phase (fade-in 100 ms done, fade-out not started). */
const CUE_HOLD_MS = 350;
/** Into the afterimage window (250 ms) with the glyph already opaque. */
const CUE_GHOST_MS = 130;

interface ForcedSignals {
  readonly currentManeuver?: string;
  readonly boostCooldown?: number;
  readonly barrelRollCooldown?: number;
}

interface ForcedEnemy {
  readonly bearingDeg: number;
  readonly distancePx: number;
}

async function installForce(page: Page): Promise<void> {
  await page.evaluate(
    ({ range, arc }) => {
      const w = window as any;
      const battleHud = w.game.scene.getScene("ArcadeBattleScene").hud.battleHud;
      const original = battleHud.update.bind(battleHud);
      w.__hudForce = { signals: null, enemy: undefined, jump: null };
      battleHud.update = (snapshot: any) => {
        const force = w.__hudForce;
        if (snapshot.player === null) return original(snapshot);
        const player = {
          ...snapshot.player,
          weaponRangePx: range,
          firingArcDeg: arc,
        };
        if (force.signals)
          player.maneuverSignals = {
            ...player.maneuverSignals,
            ...force.signals,
          };
        const rad = (deg: number) => (deg * Math.PI) / 180;
        if (force.jump) {
          const a = rad(player.pose.angle);
          const { forward, right } = force.jump;
          player.pose = {
            ...player.pose,
            x: player.pose.x + Math.sin(a) * forward + Math.cos(a) * right,
            y: player.pose.y - Math.cos(a) * forward + Math.sin(a) * right,
          };
          force.jump = null;
        }
        let contacts = snapshot.contacts;
        if (force.enemy !== undefined) {
          contacts = contacts.filter((c: any) => c.side !== "enemy");
          if (force.enemy !== null) {
            const a = rad(player.pose.angle + force.enemy.bearingDeg);
            contacts = [
              ...contacts,
              {
                id: "forced-enemy",
                pose: {
                  x: player.pose.x + Math.sin(a) * force.enemy.distancePx,
                  y: player.pose.y - Math.cos(a) * force.enemy.distancePx,
                  angle: 180,
                },
                side: "enemy",
                sizeClass: "small",
                isTarget: true,
                alive: true,
              },
            ];
          }
        }
        original({ ...snapshot, player, contacts });
      };
    },
    { range: WEAPON_RANGE_PX, arc: FIRING_ARC_DEG },
  );
}

async function force(
  page: Page,
  patch: {
    signals?: ForcedSignals | null;
    enemy?: ForcedEnemy | null;
    jump?: { forward: number; right: number } | null;
  },
): Promise<void> {
  await page.evaluate((p) => {
    Object.assign((window as any).__hudForce, p);
  }, patch);
}

async function shot(page: Page, name: string): Promise<void> {
  await page
    .locator("canvas")
    .screenshot({ path: `${OUT_DIR}/${name}.png`, animations: "allow" });
}

/** Clears the forced signals, waits for the old cue to end, then fires one. */
async function cue(
  page: Page,
  name: string,
  trigger: {
    signals: ForcedSignals;
    jump?: { forward: number; right: number };
  },
  waitMs: number,
): Promise<void> {
  await force(page, { signals: null, jump: null });
  await page.waitForTimeout(CUE_GONE_MS);
  await force(page, { signals: trigger.signals, jump: trigger.jump ?? null });
  await page.waitForTimeout(waitMs);
  await shot(page, name);
}

async function setReducedMotion(page: Page, reduced: boolean): Promise<void> {
  await page.evaluate(async (value) => {
    const mod = await import("/src/ui/settings/motionComfort.ts");
    mod.setMotionReduced(value);
  }, reduced);
}

test.describe("HUD cue screenshots", () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });
    await SKIRMISH.enter(page, { peaceful: true });
    await installForce(page);
    await force(page, { enemy: null });
    await page.waitForTimeout(500);
  });

  test("maneuver cues", async ({ page }) => {
    await shot(page, "maneuver-00-baseline");
    await cue(page, "maneuver-snap", { signals: { currentManeuver: "kturn" } }, CUE_HOLD_MS);
    await cue(page, "maneuver-hook-left", { signals: { currentManeuver: "segnor_left" } }, CUE_HOLD_MS);
    await cue(page, "maneuver-hook-right", { signals: { currentManeuver: "segnor_right" } }, CUE_HOLD_MS);
    await cue(page, "maneuver-knife-left", { signals: { currentManeuver: "tallon_left" } }, CUE_HOLD_MS);
    await cue(page, "maneuver-knife-right", { signals: { currentManeuver: "tallon_right" } }, CUE_HOLD_MS);
    await cue(
      page,
      "maneuver-boost-ghosts",
      { signals: { boostCooldown: 4500 }, jump: { forward: 110, right: 0 } },
      CUE_GHOST_MS,
    );
    await cue(
      page,
      "maneuver-roll-left-ghosts",
      { signals: { barrelRollCooldown: 3000 }, jump: { forward: 0, right: -70 } },
      CUE_GHOST_MS,
    );
    await cue(
      page,
      "maneuver-roll-right-hold",
      { signals: { barrelRollCooldown: 3000 }, jump: { forward: 0, right: 70 } },
      CUE_HOLD_MS,
    );
  });

  test("maneuver cue with Reduce Motion (static glyph, no ghosts)", async ({ page }) => {
    await setReducedMotion(page, true);
    await cue(
      page,
      "maneuver-reduced-boost",
      { signals: { boostCooldown: 4500 }, jump: { forward: 110, right: 0 } },
      CUE_GHOST_MS,
    );
    await setReducedMotion(page, false);
  });

  test("firing cues", async ({ page }) => {
    const states: ReadonlyArray<readonly [string, ForcedEnemy | null]> = [
      ["fire-00-no-hostile-near", null],
      ["fire-01-far-out-of-range", { bearingDeg: 0, distancePx: WEAPON_RANGE_PX * 1.8 }],
      ["fire-02-in-arc-out-of-range", { bearingDeg: 10, distancePx: WEAPON_RANGE_PX * 1.3 }],
      ["fire-03-in-range-in-arc", { bearingDeg: 10, distancePx: 150 }],
      ["fire-04-out-of-arc-turn-right", { bearingDeg: 90, distancePx: 150 }],
      ["fire-05-out-of-arc-turn-left-behind", { bearingDeg: -140, distancePx: 150 }],
    ];
    for (const [name, enemy] of states) {
      await force(page, { enemy });
      await page.waitForTimeout(250);
      await shot(page, name);
    }
  });
});
