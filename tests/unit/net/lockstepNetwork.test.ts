/**
 * Lockstep over simulated networks: real LockstepSessions talking to the real
 * RelayCore through LatencyLanes, each running the ReferenceDuelSim. Every
 * scenario asserts that all clients computed identical state hashes.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../../server/src/config";
import { createSilentLogger } from "../../../server/src/logger";
import { RelayCore } from "../../../server/src/RelayCore";
import { createCoreRelayHost } from "../../../server/src/sim/coreRelayHost";
import {
  IDEAL_LINK,
  type LinkConditions,
} from "../../../src/net/sim/LatencyLane";
import { LockstepHarness } from "../../../src/net/sim/LockstepHarness";
import {
  DUEL_BITS,
  DUEL_EDGE_MASK,
  ReferenceDuelSim,
} from "../../../src/net/sim/ReferenceDuelSim";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import type { HarnessClientSpec } from "../../../src/net/sim/HarnessClient";
import type { LockstepSimulation } from "../../../src/net/lockstep/types";
import { seededRandom } from "../server/relayFixtures";

const MINUTE_MS = 60_000;

function link(
  latencyMs: number,
  jitterMs = 0,
  lossRate = 0,
  lossMode: LinkConditions["lossMode"] = "retransmit",
): LinkConditions {
  return { latencyMs, jitterMs, lossRate, lossMode };
}

function player(
  name: string,
  conditions: LinkConditions,
  frameJitterMs = 2,
): HarnessClientSpec {
  return { name, up: conditions, down: conditions, frameJitterMs };
}

/** Scripted pilots: each client weaves, thrusts, fires and boosts on its own rhythm. */
function scriptedInput(client: number, tick: number): number {
  const phase = Math.floor(tick / (40 + client * 13)) % 4;
  const steer =
    phase === 0 ? DUEL_BITS.left : phase === 2 ? DUEL_BITS.right : 0;
  const boost = tick % (97 + client * 31) === 0 ? DUEL_BITS.boost : 0;
  return steer | DUEL_BITS.thrust | DUEL_BITS.fire | boost;
}

function harness(
  clients: HarnessClientSpec[],
  mode: "dogfight" | "skirmish" = "dogfight",
) {
  const scheduler = new VirtualScheduler(1_000_000);
  const config = {
    ...DEFAULT_CONFIG,
    startCountdownMs: 500,
    reconnectWindowMs: 20_000,
  };
  const core = new RelayCore({
    scheduler,
    config,
    logger: createSilentLogger(),
    random: seededRandom(9),
  });
  const h = new LockstepHarness({
    relay: createCoreRelayHost(core),
    scheduler,
    clients,
    seed: 77,
    mode,
    createSim: (match) => new ReferenceDuelSim(match.seed, match.seats.length),
    input: scriptedInput,
    edgeMask: DUEL_EDGE_MASK,
  });
  return { h, core, scheduler };
}

function expectInSync(h: LockstepHarness, minTicks: number): void {
  const comparison = h.compareHashes();
  expect(comparison.mismatches).toBe(0);
  expect(comparison.compared).toBeGreaterThan(minTicks);
}

describe("lockstep over simulated networks", () => {
  it("keeps two clients identical for 60 s on a perfect link without stalling", () => {
    const { h } = harness([
      player("A", IDEAL_LINK, 0),
      player("B", IDEAL_LINK, 0),
    ]);
    expect(h.start()).toBe(true);
    h.run(MINUTE_MS);
    expectInSync(h, 3500);
    for (const m of h.metrics(MINUTE_MS))
      expect(m.stallFramePct).toBeLessThan(1);
  });

  it("stays identical over a regional link (40 ms ± 15 ms each way, frame jitter)", () => {
    const { h, core } = harness([
      player("A", link(40, 15)),
      player("B", link(25, 10)),
    ]);
    expect(h.start()).toBe(true);
    h.run(MINUTE_MS);
    expectInSync(h, 3400);
    expect(core.stats().desyncs).toBe(0);
    for (const m of h.metrics(MINUTE_MS))
      expect(m.stallFramePct).toBeLessThan(5);
  });

  it("stays identical across continents with TCP retransmits (90 ms ± 40 ms, 2% loss)", () => {
    const { h } = harness([
      player("A", link(90, 40, 0.02)),
      player("B", link(60, 30, 0.02)),
    ]);
    expect(h.start()).toBe(true);
    h.run(MINUTE_MS);
    expectInSync(h, 3000);
  });

  it("recovers dropped messages through redundant resends (5% outright loss)", () => {
    const { h } = harness([
      player("A", link(30, 10, 0.05, "drop")),
      player("B", link(30, 10, 0.05, "drop")),
    ]);
    expect(h.start()).toBe(true);
    h.run(MINUTE_MS);
    expectInSync(h, 3000);
  });

  it("keeps a four-player skirmish identical", () => {
    const specs = [link(20, 5), link(35, 10), link(50, 20), link(15, 5)].map(
      (l, i) => player(`P${i}`, l),
    );
    const { h } = harness(specs, "skirmish");
    expect(h.start()).toBe(true);
    h.run(30_000);
    expectInSync(h, 1500);
  });
});

describe("desync detection and resync", () => {
  it("detects a diverged client from the hash reports and resyncs it from the authority", () => {
    const { h, core } = harness([
      player("A", link(30, 5)),
      player("B", link(30, 5)),
    ]);
    expect(h.start()).toBe(true);
    h.run(5_000);
    const diverged = h.clients[1]!;
    corrupt(diverged.sim!, diverged.session!.tick);
    h.run(10_000);
    expect(core.stats().desyncs).toBeGreaterThanOrEqual(1);
    expect(diverged.session!.stats.snapshotsApplied).toBeGreaterThanOrEqual(1);
    const comparison = h.compareHashes();
    expect(comparison.lastMismatch).not.toBeNull();
    const after = [...diverged.hashes.keys()].filter(
      (t) => t > (comparison.lastMismatch ?? 0),
    );
    expect(after.length).toBeGreaterThan(300);
  });
});

describe("disconnects", () => {
  it("lets the AI fly a dropped player so the other never stalls, then resyncs them on reconnect", () => {
    const { h } = harness([player("A", link(30, 5)), player("B", link(30, 5))]);
    expect(h.start()).toBe(true);
    h.run(5_000);
    const [host, guest] = h.clients;
    const hostTicksBefore = host!.session!.stats.ticksRun;
    guest!.drop();
    h.run(3_000);
    expect(host!.session!.stats.ticksRun - hostTicksBefore).toBeGreaterThan(
      170,
    );
    guest!.connect();
    h.run(10_000);
    expect(guest!.session!.stats.snapshotsApplied).toBe(1);
    const comparison = h.compareHashes();
    const lastBad = comparison.lastMismatch ?? -1;
    const agreedAfter = [...guest!.hashes.keys()].filter(
      (t) => t > lastBad && host!.hashes.get(t) === guest!.hashes.get(t),
    );
    expect(agreedAfter.length).toBeGreaterThan(400);
  });

  it("brings a reloaded page back into the running match through a snapshot", () => {
    const { h } = harness([player("A", link(20, 5)), player("B", link(20, 5))]);
    expect(h.start()).toBe(true);
    h.run(4_000);
    const guest = h.clients[1]!;
    guest.drop(true);
    h.run(1_000);
    guest.connect();
    h.run(8_000);
    expect(guest.session?.stats.snapshotsApplied).toBe(1);
    expect(guest.session!.tick).toBeGreaterThan(600);
    const host = h.clients[0]!;
    const tail = [...guest.hashes.keys()].slice(-200);
    expect(tail.every((t) => host.hashes.get(t) === guest.hashes.get(t))).toBe(
      true,
    );
  });
});

/** Push one ship 50 px off course on this client only (a simulated determinism bug). */
function corrupt(sim: LockstepSimulation, tick: number): void {
  const state = JSON.parse(sim.snapshot(tick)) as {
    tick: number;
    rng: number;
    ships: Array<{ x: number }>;
  };
  state.ships[0]!.x += 50;
  sim.restore(tick, JSON.stringify(state));
}
