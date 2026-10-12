/**
 * net_measure — the measurements behind docs/adr/ADR-0005-online-netcode.md.
 *
 * For each network profile it measures:
 * - Deterministic lockstep (the chosen design), end to end through the real
 *   relay logic over simulated links: input delay, stalls, bandwidth and
 *   whether both clients computed identical state every tick.
 * - Host-authoritative snapshot interpolation (the alternative), on the same
 *   trajectories: how far the opponent's ship is drawn from where it really
 *   is, the input latency of the guest's own ship without prediction, and
 *   the downstream bandwidth of 20 Hz snapshots.
 *
 * Usage: npx tsx scripts/net_measure.ts
 */

import { DEFAULT_CONFIG } from "../server/src/config";
import { createSilentLogger } from "../server/src/logger";
import { RelayCore } from "../server/src/RelayCore";
import { createCoreRelayHost } from "../server/src/sim/coreRelayHost";
import { TICK_MS } from "../src/net/protocol";
import { DeterministicRng } from "../src/net/lockstep/DeterministicRng";
import type { LinkConditions } from "../src/net/sim/LatencyLane";
import { LockstepHarness } from "../src/net/sim/LockstepHarness";
import {
  DUEL_BITS,
  DUEL_EDGE_MASK,
  ReferenceDuelSim,
} from "../src/net/sim/ReferenceDuelSim";
import { VirtualScheduler } from "../src/net/sim/VirtualScheduler";

/** Measured run length (virtual ms). */
const RUN_MS = 60_000;
/** Snapshot model: send rate and interpolation buffer (typical values). */
const SNAPSHOT_HZ = 20;
const INTERP_DELAY_MS = 100;
/** Team battle size for the snapshot bandwidth estimate (ships + live projectiles). */
const TEAM_BATTLE_SHIPS = 12;
const TEAM_BATTLE_PROJECTILES = 24;
/** Fields a real-time ArcadeShip needs replicated to render and predict (pose, velocity, maneuver, hull, shields, stress, cooldowns, crew, cloak, ordnance…). */
const REAL_SHIP_FIELDS = 24;
const PROJECTILE_FIELDS = 7;
/** JSON bytes per quantized numeric field ("1234.5," + key overhead in a positional array). */
const BYTES_PER_FIELD = 7;

interface Profile {
  readonly name: string;
  readonly a: LinkConditions;
  readonly b: LinkConditions;
}

/** TCP fast retransmit: about one hop round trip plus three duplicate ACKs at 60 messages/s. */
const FAST_RETRANSMIT_EXTRA_MS = 50;

const link = (
  latencyMs: number,
  jitterMs: number,
  lossRate = 0,
): LinkConditions => ({
  latencyMs,
  jitterMs,
  lossRate,
  lossMode: "retransmit",
  retransmitMs: 2 * latencyMs + FAST_RETRANSMIT_EXTRA_MS,
});

const PROFILES: readonly Profile[] = [
  { name: "LAN", a: link(2, 1), b: link(2, 1) },
  { name: "Regional", a: link(20, 8), b: link(30, 10) },
  { name: "Cross-country", a: link(35, 15), b: link(45, 15) },
  { name: "Intercontinental", a: link(60, 25, 0.01), b: link(90, 30, 0.01) },
  { name: "Bad Wi-Fi", a: link(25, 60, 0.03), b: link(30, 20, 0.01) },
];

function scriptedInput(client: number, tick: number): number {
  const phase = Math.floor(tick / (40 + client * 13)) % 4;
  const steer =
    phase === 0 ? DUEL_BITS.left : phase === 2 ? DUEL_BITS.right : 0;
  const boost = tick % (97 + client * 31) === 0 ? DUEL_BITS.boost : 0;
  return steer | DUEL_BITS.thrust | DUEL_BITS.fire | boost;
}

function runLockstep(profile: Profile, players = 2, adaptiveDelay = true) {
  const scheduler = new VirtualScheduler(1_000_000);
  const core = new RelayCore({
    scheduler,
    logger: createSilentLogger(),
    config: { ...DEFAULT_CONFIG, startCountdownMs: 500 },
    random: {
      int: (n) => Math.floor(Math.random() * n),
      token: () => Math.random().toString(36).slice(2),
    },
  });
  const specs = Array.from({ length: players }, (_, i) => {
    const l = i % 2 === 0 ? profile.a : profile.b;
    return { name: `P${i}`, up: l, down: l, frameJitterMs: 2 };
  });
  const h = new LockstepHarness({
    relay: createCoreRelayHost(core),
    scheduler,
    clients: specs,
    seed: 2026,
    mode: players > 2 ? "skirmish" : "dogfight",
    createSim: (m) => new ReferenceDuelSim(m.seed, m.seats.length),
    input: scriptedInput,
    edgeMask: DUEL_EDGE_MASK,
    adaptiveDelay,
  });
  if (!h.start()) throw new Error(`${profile.name}: match never started`);
  h.run(RUN_MS);
  const metrics = h.metrics(RUN_MS);
  const hashes = h.compareHashes();
  return {
    delayTicks: h.clients[0]?.session?.matchDelay ?? 0,
    finalDelayTicks: Math.max(
      ...h.clients.map((c) => c.session?.inputDelay ?? 0),
    ),
    stallFramePct: Math.max(...metrics.map((m) => m.stallFramePct)),
    stallTimePct: Math.max(...metrics.map((m) => (100 * m.stallMs) / RUN_MS)),
    longestStallMs: Math.max(...metrics.map((m) => m.longestStallMs)),
    upKBs: Math.max(...metrics.map((m) => m.upBytesPerS)) / 1000,
    downKBs: Math.max(...metrics.map((m) => m.downBytesPerS)) / 1000,
    agreement:
      hashes.compared > 0 ? 100 * (1 - hashes.mismatches / hashes.compared) : 0,
    ticksCompared: hashes.compared,
  };
}

/** Records the reference duel's true trajectory of ship 0 (the host). */
function recordTrajectory(): Array<{ x: number; y: number }> {
  const sim = new ReferenceDuelSim(2026, 2);
  const path: Array<{ x: number; y: number }> = [];
  for (let tick = 0; tick < RUN_MS / TICK_MS; tick++) {
    sim.step(tick, [scriptedInput(0, tick), scriptedInput(1, tick)]);
    const ship = sim.ships[0]!;
    path.push({ x: ship.x, y: ship.y });
  }
  return path;
}

function torusDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const field = 3000;
  const dx = Math.abs(a.x - b.x) % field;
  const dy = Math.abs(a.y - b.y) % field;
  return Math.hypot(Math.min(dx, field - dx), Math.min(dy, field - dy));
}

/** Snapshot interpolation as the guest would draw the host's ship. */
function measureSnapshotModel(
  profile: Profile,
  path: ReadonlyArray<{ x: number; y: number }>,
) {
  const rng = new DeterministicRng(5);
  const oneWay = (): number =>
    profile.a.latencyMs +
    profile.b.latencyMs +
    rng.next() * (profile.a.jitterMs + profile.b.jitterMs);
  const everyTicks = Math.round(1000 / SNAPSHOT_HZ / TICK_MS);
  const arrivals: Array<{ at: number; tick: number }> = [];
  for (let tick = 0; tick < path.length; tick += everyTicks)
    arrivals.push({ at: tick * TICK_MS + oneWay(), tick });
  arrivals.sort((p, q) => p.at - q.at);
  const errors: number[] = [];
  let received = 0;
  for (let tick = 60; tick < path.length; tick++) {
    const now = tick * TICK_MS;
    while (received < arrivals.length && arrivals[received]!.at <= now)
      received++;
    const renderTick = Math.max(
      0,
      Math.floor((now - INTERP_DELAY_MS) / TICK_MS),
    );
    const known = arrivals
      .slice(0, received)
      .filter((s) => s.tick <= renderTick)
      .map((s) => s.tick);
    const shownTick = known.length > 0 ? Math.max(...known) : 0;
    errors.push(torusDistance(path[shownTick]!, path[tick]!));
  }
  errors.sort((p, q) => p - q);
  const oneWayMs = profile.a.latencyMs + profile.b.latencyMs;
  return {
    p50: errors[Math.floor(errors.length * 0.5)] ?? 0,
    p95: errors[Math.floor(errors.length * 0.95)] ?? 0,
    // Guest input → relay → host simulates → snapshot → relay → guest, then the interpolation buffer.
    guestInputLatencyMs: 2 * oneWayMs + INTERP_DELAY_MS,
  };
}

function snapshotBandwidthKBs(ships: number, projectiles: number): number {
  const bytes =
    (ships * REAL_SHIP_FIELDS + projectiles * PROJECTILE_FIELDS) *
    BYTES_PER_FIELD;
  return (bytes * SNAPSHOT_HZ) / 1000;
}

function main(): void {
  const path = recordTrajectory();
  const meanSpeed =
    path.slice(1).reduce((sum, p, i) => sum + torusDistance(p, path[i]!), 0) /
    (((path.length - 1) * TICK_MS) / 1000);
  console.log(
    `Reference duel: ${RUN_MS / 1000} s, mean ship speed ${meanSpeed.toFixed(0)} px/s\n`,
  );
  console.log(
    "LOCKSTEP (measured end to end through RelayCore; adaptive = per-client delay tuning)",
  );
  console.log(
    "profile           | mode     | delay start→end | stall frames | stall time | longest stall | up KB/s | down KB/s | identical ticks",
  );
  for (const profile of PROFILES) {
    for (const adaptive of [false, true]) {
      const r = runLockstep(profile, 2, adaptive);
      const delay = `${r.delayTicks}→${r.finalDelayTicks} t (${(r.finalDelayTicks * TICK_MS).toFixed(0)} ms)`;
      console.log(
        `${profile.name.padEnd(17)} | ${(adaptive ? "adaptive" : "fixed").padEnd(8)} | ${delay.padEnd(15)} | ${r.stallFramePct.toFixed(1).padStart(11)}% | ${r.stallTimePct.toFixed(2).padStart(9)}% | ${r.longestStallMs.toFixed(0).padStart(10)} ms | ${r.upKBs.toFixed(1).padStart(7)} | ${r.downKBs.toFixed(1).padStart(9)} | ${r.agreement.toFixed(2)}% of ${r.ticksCompared}`,
      );
    }
  }
  const team = runLockstep(PROFILES[1]!, 4);
  console.log(
    `4-player skirmish, Regional: delay ${team.delayTicks} t, stall time ${team.stallTimePct.toFixed(2)}%, down ${team.downKBs.toFixed(1)} KB/s, identical ${team.agreement.toFixed(2)}%`,
  );
  console.log(
    "\nSNAPSHOT INTERPOLATION (host-authoritative, 20 Hz, 100 ms buffer)",
  );
  console.log(
    "profile           | opponent drawn off by p50 / p95 | guest own-ship input latency (no prediction)",
  );
  for (const profile of PROFILES) {
    const r = measureSnapshotModel(profile, path);
    console.log(
      `${profile.name.padEnd(17)} | ${r.p50.toFixed(0).padStart(6)} px / ${r.p95.toFixed(0).padStart(4)} px          | ${r.guestInputLatencyMs.toFixed(0)} ms`,
    );
  }
  console.log(
    `snapshot downstream: duel ${snapshotBandwidthKBs(2, 4).toFixed(1)} KB/s, ${TEAM_BATTLE_SHIPS}-ship team battle ${snapshotBandwidthKBs(TEAM_BATTLE_SHIPS, TEAM_BATTLE_PROJECTILES).toFixed(1)} KB/s per client (host upstream × peers)`,
  );
}

main();
