/**
 * duel-tempo.spec.ts — the X-Wing round tempo inside the real Dogfight and
 * Ace Duel scenes. Two equal pilots (same hull, both flown by the duel AI at
 * normal) fight one round while every damaging hit is logged:
 *
 *  - an attacker never damages the same target twice within one maneuver
 *    cycle (hit immunity), and
 *  - the round's duration from weapons-live to the kill is recorded as a
 *    test annotation (the headless DuelTempoSim measures many seeds).
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

/** One maneuver cycle (CYCLE_DURATION_MS) less one frame of timer slack. */
const MIN_HIT_GAP_MS = 500 - 1;
/** The round limit is 180 s; allow the banner and some slack. */
const ROUND_WAIT_MS = 190_000;
const MIRROR_SHIP = "confed_falcon";

interface TempoLog {
  hits: Array<{ key: string; at: number }>;
  start: number | null;
  end: number | null;
  result: unknown;
}

async function openSetup(
  page: Page,
  label: string,
  sceneKey: string,
): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await clickMenuItem(page, label);
  await waitForScene(page, sceneKey, 30_000);
}

/** Wraps applyHit / endRound / the banner callback to log the round. */
async function instrument(page: Page, sceneKey: string): Promise<void> {
  await page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    const log = { hits: [], start: null, end: null, result: null };
    s.__tempo = log;
    const applyHit = s.applyHit.bind(s);
    s.applyHit = (a: any, t: any, r: any) => {
      log.hits.push({ key: `${a.id}>${t.id}`, at: s.time.now } as never);
      applyHit(a, t, r);
    };
    const endRound = s.endRound.bind(s);
    s.endRound = (r: unknown) => {
      if (log.end === null) {
        log.end = s.time.now as never;
        log.result = r as never;
      }
      endRound(r);
    };
  }, sceneKey);
}

async function fightOneRound(page: Page, sceneKey: string): Promise<TempoLog> {
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key).isRoundActive === true,
    sceneKey,
    { polling: 16, timeout: 15_000 },
  );
  await page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    s.__tempo.start = s.time.now;
  }, sceneKey);
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key).__tempo.end !== null,
    sceneKey,
    { polling: 250, timeout: ROUND_WAIT_MS },
  );
  return page.evaluate(
    (key) => (window as any).game.scene.getScene(key).__tempo,
    sceneKey,
  );
}

function expectHitImmunity(log: TempoLog): void {
  const lastHit = new Map<string, number>();
  for (const hit of log.hits) {
    const previous = lastHit.get(hit.key);
    if (previous !== undefined) {
      expect(hit.at - previous, hit.key).toBeGreaterThanOrEqual(MIN_HIT_GAP_MS);
    }
    lastHit.set(hit.key, hit.at);
  }
  expect(log.hits.length).toBeGreaterThan(0);
}

function report(name: string, log: TempoLog): void {
  const seconds = ((log.end! - log.start!) / 1000).toFixed(1);
  test.info().annotations.push({
    type: "round-duration",
    description: `${name}: ${seconds} s, ${log.hits.length} hits, result ${String(log.result)}`,
  });
  console.log(`[duel-tempo] ${name}: ${seconds} s, ${log.hits.length} hits`);
}

test.describe("Duel round tempo in the live scenes", () => {
  test.setTimeout(240_000);

  test("Dogfight: equal AI pilots respect hit immunity", async ({ page }) => {
    await openSetup(page, "DOGFIGHT", "DogfightScene");
    await instrument(page, "DogfightScene");
    await page.evaluate((ship) => {
      const s = (window as any).game.scene.getScene("DogfightScene");
      s.playerShipId = ship;
      s.enemyShipId = ship;
      s.enemyFaction = "terran_hegemony";
      s.flyPlayer = (own: any) => {
        const foe = s.ships.get("ai_0");
        if (foe && foe.hull > 0) s.steerAi(own, foe);
      };
      s.startMatch();
    }, MIRROR_SHIP);
    const log = await fightOneRound(page, "DogfightScene");
    expectHitImmunity(log);
    report("Dogfight falcon mirror", log);
  });

  test("Ace Duel: equal AI pilots respect hit immunity", async ({ page }) => {
    await openSetup(page, "ACE DUEL", "AceDuelScene");
    await instrument(page, "AceDuelScene");
    await page.evaluate((ship) => {
      const s = (window as any).game.scene.getScene("AceDuelScene");
      const side = (faction: string, name: string) => ({
        name,
        faction,
        ships: [ship],
        abilities: [],
      });
      s.selectedMatchup = {
        id: "tempo_mirror",
        name: "Tempo mirror",
        description: "",
        flavorText: "",
        side1: side("free_confederation", "Blue"),
        side2: side("terran_hegemony", "Red"),
      };
      s.flyPlayer = (own: any) => s.steerAi(own);
      s.startDuel();
      // The flagship flies as an equal AI pilot (normal difficulty).
      s.ships.get(s.flagshipId).owner = "ai";
    }, MIRROR_SHIP);
    const log = await fightOneRound(page, "AceDuelScene");
    expectHitImmunity(log);
    report("Ace Duel falcon mirror", log);
  });
});
