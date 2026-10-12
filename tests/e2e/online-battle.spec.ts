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
  waitForTicks,
  type OnlineDebug,
} from "./helpers/onlineBattle";

/** One-way client↔relay latency ± jitter (ms): a regional link. */
const NETSIM = "40,15";
/** Ticks of play compared: 60 s at 60 Hz. */
const MATCH_TICKS = 3600;
/** Real time allowed to simulate them (stalls included). */
const PLAY_TIMEOUT_MS = 100_000;

let relay: RunningRelay;

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
async function playMinute(pages: readonly Page[], sceneKey: string) {
  const flying = pages.map(async (page, i) => {
    for (let round = 0; round < 8; round++)
      await flyAround(page, i * 7 + round);
  });
  await Promise.all([
    ...flying,
    ...pages.map((p) =>
      waitForTicks(p, sceneKey, MATCH_TICKS, PLAY_TIMEOUT_MS),
    ),
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
