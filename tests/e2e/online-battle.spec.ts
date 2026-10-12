/**
 * Online battles end to end: two browser contexts, each behind the
 * `?netsim=` latency simulator, meet in a room on an in-process relay and
 * fly a real battle on the input lockstep. Every tick both clients hash
 * their simulation; over a minute of play the traces must be identical
 * (no desync, no resync) while both pilots throw real input at it.
 */

import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_CONFIG } from "../../server/src/config";
import { createSilentLogger } from "../../server/src/logger";
import { startRelayServer, type RunningRelay } from "../../server/src/wsServer";
import { packSnapshot } from "../../src/net/lockstep/snapshotPacking";
import { NET_LIMITS } from "../../src/net/protocol";
import { clickMenuItem, waitForMenuReady, waitForScene } from "./helpers/game";
import {
  compareTraces,
  expectGuestSteersOnHost,
  expectIdentical,
  flyAround,
  onlineDebug,
  openOnlineLobby,
  startOnlineMatch,
  startOnlineRoom,
  waitForTicks,
  type OnlineDebug,
} from "./helpers/onlineBattle";

/** One-way client↔relay latency ± jitter (ms): a regional link. */
const NETSIM = "40,15";
/** Ticks of play compared: 60 s at 60 Hz. */
const MATCH_TICKS = 3600;
/** Real time allowed to simulate them (stalls included). */
const PLAY_TIMEOUT_MS = 100_000;
/** The same minute with four clients on one machine (each renders a full battle). */
const FOUR_CLIENT_PLAY_TIMEOUT_MS = 300_000;
const FOUR_CLIENT_TEST_TIMEOUT_MS = 480_000;

const HEG = "terran_hegemony";
const COR = "void_corsairs";
const HEGEMONY_SQUAD = {
  faction: HEG,
  ships: ["terran_gladius", "terran_viper", "terran_viper"],
};
const CORSAIR_SQUAD = {
  faction: COR,
  ships: ["corsair_raider", "corsair_raider", "corsair_raider"],
};

let relay: RunningRelay;

/** Reads an expression over the page's ArcadeBattleScene (`scene`). */
async function arcade<T>(page: Page, expression: string): Promise<T> {
  return page.evaluate(
    (expr) =>
      new Function("scene", `return ${expr};`)(
        (window as any).game.scene.getScene("ArcadeBattleScene"),
      ),
    expression,
  ) as Promise<T>;
}

/** Every seat's faction and team, and its flagship's team, as this client simulates them. */
async function seatSides(
  page: Page,
): Promise<{ faction: string; team: number }[]> {
  const sides = await arcade<
    { faction: string; team: number; shipTeam: number }[]
  >(
    page,
    "scene.online.battle.seats.map((s, i) => ({ faction: s.faction, team: s.team, shipTeam: scene.ships.get(scene.online.shipOf(i)).team }))",
  );
  for (const side of sides) expect(side.shipTeam).toBe(side.team);
  return sides.map(({ faction, team }) => ({ faction, team }));
}

test.beforeAll(async () => {
  relay = await startRelayServer(
    {
      ...DEFAULT_CONFIG,
      port: 0,
      host: "127.0.0.1",
      startCountdownMs: 300,
    },
    { logger: createSilentLogger() },
  );
});

test.afterAll(async () => {
  await relay.close();
});

/** Both pilots fly until the battle has run `MATCH_TICKS` ticks. */
async function playMinute(
  pages: readonly Page[],
  sceneKey: string,
  timeoutMs = PLAY_TIMEOUT_MS,
) {
  const flying = pages.map(async (page, i) => {
    for (let round = 0; round < 8; round++)
      await flyAround(page, i * 7 + round);
  });
  await Promise.all([
    ...flying,
    ...pages.map((p) => waitForTicks(p, sceneKey, MATCH_TICKS, timeoutMs)),
  ]);
}

function report(name: string, debug: readonly OnlineDebug[]): void {
  const line = `${name}: ${debug
    .map(
      (d, seat) =>
        `client ${seat}: delay ${d.inputDelay} t, stall ${Math.round(d.stats.stallMs)} ms (longest ${Math.round(d.stats.longestStallMs)} ms), sent ${Math.round(d.stats.bytesSent / 1024)} KB, resyncs ${d.stats.resyncs}`,
    )
    .join("; ")}`;
  console.log(`[netcode] ${line}`);
  test.info().annotations.push({ type: "netcode", description: line });
}

test.describe("online battles stay in lockstep", () => {
  test.setTimeout(240_000);

  test("Dogfight: a minute of play hashes identically on both clients", async ({
    browser,
  }) => {
    const host = await openOnlineLobby(browser, relay.port, NETSIM);
    const guest = await openOnlineLobby(browser, relay.port, NETSIM);
    await startOnlineMatch(host, guest, "dogfight", "DogfightScene");
    await waitForTicks(host, "DogfightScene", 240, 30_000);
    await expectGuestSteersOnHost(host, guest, "DogfightScene");
    await playMinute([host, guest], "DogfightScene");
    const debug = [
      await onlineDebug(host, "DogfightScene"),
      await onlineDebug(guest, "DogfightScene"),
    ];
    report("Dogfight", debug);
    expectIdentical(debug[0]!, debug[1]!, MATCH_TICKS - 600);
    expect(debug[0]!.stats.hashesSent).toBeGreaterThan(100);
    await host.context().close();
    await guest.context().close();
  });

  test("Reinforcements: a minute of a squad battle hashes identically on both clients", async ({
    browser,
  }) => {
    const host = await openOnlineLobby(browser, relay.port, NETSIM);
    const guest = await openOnlineLobby(browser, relay.port, NETSIM);
    await startOnlineMatch(host, guest, "reinforcements", "ArcadeBattleScene");
    await waitForTicks(host, "ArcadeBattleScene", 240, 30_000);
    await expectGuestSteersOnHost(host, guest, "ArcadeBattleScene");
    await playMinute([host, guest], "ArcadeBattleScene");
    const debug = [
      await onlineDebug(host, "ArcadeBattleScene"),
      await onlineDebug(guest, "ArcadeBattleScene"),
    ];
    report("Reinforcements", debug);
    expectIdentical(debug[0]!, debug[1]!, MATCH_TICKS - 600);
    await host.context().close();
    await guest.context().close();
  });

  test("Skirmish: a minute of a classic squad battle hashes identically on both clients", async ({
    browser,
  }) => {
    const host = await openOnlineLobby(browser, relay.port, NETSIM);
    const guest = await openOnlineLobby(browser, relay.port, NETSIM);
    await startOnlineMatch(host, guest, "skirmish", "ArcadeBattleScene");
    await waitForTicks(host, "ArcadeBattleScene", 240, 30_000);
    await expectGuestSteersOnHost(host, guest, "ArcadeBattleScene");
    await playMinute([host, guest], "ArcadeBattleScene");
    const debug = [
      await onlineDebug(host, "ArcadeBattleScene"),
      await onlineDebug(guest, "ArcadeBattleScene"),
    ];
    report("Skirmish", debug);
    expectIdentical(debug[0]!, debug[1]!, MATCH_TICKS - 600);
    await host.context().close();
    await guest.context().close();
  });

  test("Reinforcements mirror match (Hegemony vs Hegemony): two teams, a picker per seat, hashes identical", async ({
    browser,
  }) => {
    const host = await openOnlineLobby(browser, relay.port, NETSIM);
    const guest = await openOnlineLobby(browser, relay.port, NETSIM);
    await startOnlineMatch(host, guest, "reinforcements", "ArcadeBattleScene", [
      HEGEMONY_SQUAD,
      HEGEMONY_SQUAD,
    ]);
    await waitForTicks(host, "ArcadeBattleScene", 240, 30_000);
    for (const page of [host, guest]) {
      const sides = await seatSides(page);
      expect(sides.map((s) => s.faction)).toEqual([HEG, HEG]);
      expect(sides.map((s) => s.team)).toEqual([0, 1]);
      expect(await arcade<boolean>(page, "scene.gameEnded")).toBe(false);
    }
    const members = await Promise.all(
      [host, guest].map((p) =>
        arcade<string>(p, "scene.reinforcementReadout.localMember"),
      ),
    );
    expect(members).toEqual(["squad_0", "squad_1"]);
    const youRows = await Promise.all(
      [host, guest].map((p) =>
        arcade<string[]>(
          p,
          "scene.reinforcementReadout.hud.rows.map((r) => r.slice(0, 3))",
        ),
      ),
    );
    expect(youRows).toEqual([
      ["YOU", "FOE"],
      ["FOE", "YOU"],
    ]);
    await expectGuestSteersOnHost(host, guest, "ArcadeBattleScene");
    await playMinute([host, guest], "ArcadeBattleScene");
    const debug = [
      await onlineDebug(host, "ArcadeBattleScene"),
      await onlineDebug(guest, "ArcadeBattleScene"),
    ];
    report("Reinforcements mirror", debug);
    expectIdentical(debug[0]!, debug[1]!, MATCH_TICKS - 600);
    await host.context().close();
    await guest.context().close();
  });

  test("Skirmish 2v2 with mixed-faction teams: four clients hash identically", async ({
    browser,
  }) => {
    // Four game clients share one machine: lockstep runs at the slowest one's pace.
    test.setTimeout(FOUR_CLIENT_TEST_TIMEOUT_MS);
    const pages: Page[] = [];
    for (let i = 0; i < 4; i++)
      pages.push(await openOnlineLobby(browser, relay.port, NETSIM));
    // Seats alternate teams: team 0 = Hegemony + Corsairs, team 1 = Corsairs + Hegemony.
    await startOnlineRoom(pages, "skirmish", "ArcadeBattleScene", [
      HEGEMONY_SQUAD,
      CORSAIR_SQUAD,
      CORSAIR_SQUAD,
      HEGEMONY_SQUAD,
    ]);
    for (const page of pages)
      await waitForTicks(page, "ArcadeBattleScene", 240, 30_000);
    const sides = await seatSides(pages[0]!);
    expect(sides.map((s) => s.team)).toEqual([0, 1, 0, 1]);
    expect(sides.map((s) => s.faction)).toEqual([HEG, COR, COR, HEG]);
    const allies = await Promise.all(
      pages.map((p) => arcade<string[]>(p, "scene.hudReadout.rosterLabels")),
    );
    for (const labels of allies)
      expect(labels).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /^▲ (HEGEMONY \+ CORSAIRS|CORSAIRS \+ HEGEMONY)$/,
          ),
          expect.stringMatching(
            /^▼ (HEGEMONY \+ CORSAIRS|CORSAIRS \+ HEGEMONY)$/,
          ),
        ]),
      );
    await playMinute(pages, "ArcadeBattleScene", FOUR_CLIENT_PLAY_TIMEOUT_MS);
    const debug = await Promise.all(
      pages.map((p) => onlineDebug(p, "ArcadeBattleScene")),
    );
    report("Skirmish 2v2 mixed", debug);
    for (const other of debug.slice(1))
      expectIdentical(debug[0]!, other, MATCH_TICKS - 600);
    for (const page of pages) await page.context().close();
  });

  test("Skirmish: a client that reloads mid-battle rejoins through a snapshot and is back in lockstep", async ({
    browser,
  }) => {
    const host = await openOnlineLobby(browser, relay.port, NETSIM);
    const guest = await openOnlineLobby(browser, relay.port, NETSIM);
    await startOnlineMatch(host, guest, "skirmish", "ArcadeBattleScene");
    await waitForTicks(guest, "ArcadeBattleScene", 300, 30_000);
    await guest.reload();
    await waitForMenuReady(guest);
    await clickMenuItem(guest, "ONLINE");
    await waitForScene(guest, "ArcadeBattleScene", 30_000);
    await guest.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("ArcadeBattleScene").onlineDebug
          ?.stats.snapshotsApplied ?? 0) >= 1,
      undefined,
      { timeout: 30_000 },
    );
    const rejoinedAt = (await onlineDebug(guest, "ArcadeBattleScene")).tick;
    await waitForTicks(guest, "ArcadeBattleScene", rejoinedAt + 600, 30_000);
    await waitForTicks(host, "ArcadeBattleScene", rejoinedAt + 600, 30_000);
    const [a, b] = [
      await onlineDebug(host, "ArcadeBattleScene"),
      await onlineDebug(guest, "ArcadeBattleScene"),
    ];
    const after = (d: OnlineDebug) =>
      d.hashes.filter(([tick]) => tick > rejoinedAt);
    const { common, mismatched } = compareTraces(after(a), after(b));
    report("Skirmish rejoin", [a, b]);
    expect(mismatched.slice(0, 5)).toEqual([]);
    expect(common).toBeGreaterThan(400);
    await host.context().close();
    await guest.context().close();
  });

  for (const [mode, sceneKey, victim] of [
    ["skirmish", "ArcadeBattleScene", "enemy_1"],
    ["dogfight", "DogfightScene", "ai_0"],
  ] as const) {
    test(`${mode}: a corrupted client is caught by the hashes and healed by the authority's snapshot`, async ({
      browser,
    }) => {
      const host = await openOnlineLobby(browser, relay.port, NETSIM);
      const guest = await openOnlineLobby(browser, relay.port, NETSIM);
      await startOnlineMatch(host, guest, mode, sceneKey);
      await waitForTicks(guest, sceneKey, 300, 30_000);
      const snapshot = await host.evaluate(
        (key) =>
          (window as any).game.scene
            .getScene(key)
            .lockstep.snapshot(0) as string,
        sceneKey,
      );
      const packed = packSnapshot(snapshot);
      console.log(
        `[netcode] ${mode} snapshot: ${snapshot.length} chars, packed ${packed.length}`,
      );
      expect(packed.length).toBeLessThan(NET_LIMITS.maxSnapshotChars / 4);
      await guest.evaluate(
        ([key, id]) => {
          const ship = (window as any).game.scene.getScene(key).ships.get(id);
          ship.hull -= 1;
        },
        [sceneKey, victim] as const,
      );
      await guest
        .waitForFunction(
          (key) =>
            ((window as any).game.scene.getScene(key).onlineDebug?.stats
              .snapshotsApplied ?? 0) >= 1,
          sceneKey,
          { timeout: 20_000 },
        )
        .catch(async (error) => {
          const [a, b] = [
            await onlineDebug(host, sceneKey),
            await onlineDebug(guest, sceneKey),
          ];
          console.log(
            `[debug] host ${JSON.stringify({ ...a, hashes: a.hashes.slice(-3) })} guest ${JSON.stringify({ ...b, hashes: b.hashes.slice(-3) })}`,
          );
          throw error;
        });
      const healedAt = (await onlineDebug(guest, sceneKey)).tick;
      await waitForTicks(guest, sceneKey, healedAt + 600, 30_000);
      await waitForTicks(host, sceneKey, healedAt + 600, 30_000);
      const [a, b] = [
        await onlineDebug(host, sceneKey),
        await onlineDebug(guest, sceneKey),
      ];
      const after = (d: OnlineDebug) =>
        d.hashes.filter(([tick]) => tick > healedAt);
      const { common, mismatched } = compareTraces(after(a), after(b));
      report(`${mode} resync`, [a, b]);
      expect(mismatched.slice(0, 5)).toEqual([]);
      expect(common).toBeGreaterThan(400);
      await host.context().close();
      await guest.context().close();
    });
  }
});
