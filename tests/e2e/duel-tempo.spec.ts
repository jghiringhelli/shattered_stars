/**
 * duel-tempo.spec.ts — the X-Wing round tempo inside the real Dogfight and
 * Ace Duel scenes. Two equal pilots (same hull, both flown by average bots —
 * the Normal opponent, and the player's ship autopiloted by the same bot)
 * fight one round while every damaging hit is logged:
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

/**
 * The human's ship flies as an average bot (the opponent's tier at Normal)
 * for this round: a BotPilot joins the scene's crew and player input is off.
 *
 * @param idPath - Scene property holding the player's ship id.
 */
async function autopilot(
  page: Page,
  sceneKey: string,
  idPath: "playerShipIds[0]" | "flagshipId",
): Promise<void> {
  await page.evaluate(
    async ({ key, path }) => {
      const { BotPilot } = await import("/src/arcade/ai/index.ts");
      const s = (window as any).game.scene.getScene(key);
      const id = path === "flagshipId" ? s.flagshipId : s.playerShipIds[0];
      s.crew.pilots.set(id, new BotPilot("average", { random: Math.random }));
      s.flyPlayer = () => undefined;
    },
    { key: sceneKey, path: idPath },
  );
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
      s.difficulty = "normal";
      s.startMatch();
    }, MIRROR_SHIP);
    await autopilot(page, "DogfightScene", "playerShipIds[0]");
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
      s.difficulty = "normal";
      s.startDuel();
    }, MIRROR_SHIP);
    await autopilot(page, "AceDuelScene", "flagshipId");
    const log = await fightOneRound(page, "AceDuelScene");
    expectHitImmunity(log);
    report("Ace Duel falcon mirror", log);
  });
});
