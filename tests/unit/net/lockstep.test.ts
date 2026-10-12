import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  TICK_MS,
  type MatchStart,
} from "../../../src/net/protocol";
import { DeterministicRng } from "../../../src/net/lockstep/DeterministicRng";
import { AdaptiveDelay } from "../../../src/net/lockstep/AdaptiveDelay";
import { InputBuffer } from "../../../src/net/lockstep/InputBuffer";
import { LocalInputSampler } from "../../../src/net/lockstep/LocalInputSampler";
import { LockstepSession } from "../../../src/net/lockstep/LockstepSession";
import { StateHasher } from "../../../src/net/lockstep/StateHasher";
import {
  ADVANTAGE_DEADBAND_TICKS,
  MAX_TICKS_PER_FRAME,
  TickPacer,
} from "../../../src/net/lockstep/TickPacer";
import type { LockstepSimulation } from "../../../src/net/lockstep/types";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import { createSeededRng } from "../../../src/utils/random";
import type { ClientMessage } from "../../../src/net/protocol";

describe("InputBuffer", () => {
  it("treats ticks before the input delay as neutral for every seat", () => {
    const buffer = new InputBuffer(2, 0, 3);
    expect(buffer.inputsFor(2)).toEqual([NEUTRAL_INPUT, NEUTRAL_INPUT]);
    expect(buffer.inputsFor(3)).toBeNull();
  });

  it("releases a tick only when every seat's input is present", () => {
    const buffer = new InputBuffer(2, 0, 0);
    buffer.setLocal(0, 5);
    expect(buffer.inputsFor(0)).toBeNull();
    buffer.receive(1, 0, [9]);
    expect(buffer.inputsFor(0)).toEqual([5, 9]);
  });

  it("tracks each seat's contiguous frontier as the ack vector", () => {
    const buffer = new InputBuffer(2, 0, 0);
    buffer.receive(1, 0, [1, 2]);
    buffer.receive(1, 3, [4]);
    expect(buffer.ackVector()).toEqual([0, 2]);
    buffer.receive(1, 2, [3]);
    expect(buffer.nextNeeded(1)).toBe(4);
  });

  it("never lets a remote resend overwrite a stored remote input", () => {
    const buffer = new InputBuffer(2, 0, 0);
    buffer.receive(1, 0, [1]);
    buffer.receive(1, 0, [7]);
    expect(buffer.get(1, 0)).toBe(1);
  });

  it("lets the relay's version of this client's own seat win (AI fill after a rejoin)", () => {
    const buffer = new InputBuffer(2, 0, 0);
    buffer.setLocal(4, 1);
    buffer.receive(0, 4, [0x40000000]);
    expect(buffer.get(0, 4)).toBe(0x40000000);
  });

  it("forgets simulated ticks and moves frontiers past a snapshot jump", () => {
    const buffer = new InputBuffer(2, 0, 0);
    buffer.discardThrough(99);
    expect(buffer.ackVector()).toEqual([100, 100]);
    buffer.receive(1, 50, [1]);
    expect(buffer.get(1, 50)).toBeUndefined();
  });
});

describe("TickPacer", () => {
  it("releases one tick per tick-length of frame time", () => {
    const pacer = new TickPacer();
    pacer.addFrame(TICK_MS * 2.5);
    let ticks = 0;
    while (pacer.hasDueTick()) {
      pacer.consumeTick();
      ticks++;
    }
    expect(ticks).toBe(2);
    expect(pacer.alpha()).toBeCloseTo(0.5);
  });

  it("caps catch-up so a long hitch cannot fast-forward the match", () => {
    const pacer = new TickPacer();
    pacer.addFrame(10_000);
    let ticks = 0;
    while (pacer.hasDueTick()) {
      pacer.consumeTick();
      ticks++;
    }
    expect(ticks).toBe(MAX_TICKS_PER_FRAME);
  });

  it("slows down only while clearly ahead of the slowest peer", () => {
    const pacer = new TickPacer();
    for (let i = 0; i < 100; i++)
      pacer.observeAdvantage(ADVANTAGE_DEADBAND_TICKS);
    expect(pacer.rate()).toBe(1);
    for (let i = 0; i < 100; i++) pacer.observeAdvantage(5);
    expect(pacer.rate()).toBeLessThan(1);
    expect(pacer.rate()).toBeGreaterThanOrEqual(0.85);
  });
});

describe("StateHasher", () => {
  it("is deterministic and order-sensitive", () => {
    const a = new StateHasher().addFloat(1.5).addInt(2).digest();
    expect(new StateHasher().addFloat(1.5).addInt(2).digest()).toBe(a);
    expect(new StateHasher().addInt(2).addFloat(1.5).digest()).not.toBe(a);
  });

  it("ignores float noise below the quantum but catches real divergence", () => {
    const base = new StateHasher().addFloat(100.0001).digest();
    expect(new StateHasher().addFloat(100.0002).digest()).toBe(base);
    expect(new StateHasher().addFloat(100.01).digest()).not.toBe(base);
  });

  it("distinguishes NaN from numbers and folds wide integers", () => {
    expect(new StateHasher().addFloat(Number.NaN).digest()).not.toBe(
      new StateHasher().addFloat(0).digest(),
    );
    expect(new StateHasher().addInt(2 ** 40).digest()).not.toBe(
      new StateHasher().addInt(0).digest(),
    );
  });
});

describe("DeterministicRng", () => {
  it("produces the same stream as the game's seeded RNG", () => {
    const ours = new DeterministicRng(1234);
    const game = createSeededRng(1234);
    const a = Array.from({ length: 50 }, () => ours.next());
    expect(a).toEqual(Array.from({ length: 50 }, () => game.next()));
  });

  it("resumes exactly from a saved state", () => {
    const rng = new DeterministicRng(7);
    rng.next();
    const saved = rng.getState();
    const expected = [rng.next(), rng.next()];
    const restored = new DeterministicRng(0);
    restored.setState(saved);
    expect([restored.next(), restored.next()]).toEqual(expected);
  });
});

describe("LocalInputSampler", () => {
  const EDGE = 16;

  it("keeps a press shorter than a tick until a tick takes it, exactly once", () => {
    const sampler = new LocalInputSampler(EDGE);
    sampler.sample(1 | EDGE);
    sampler.sample(1);
    expect(sampler.take()).toBe(1 | EDGE);
    expect(sampler.take()).toBe(1);
  });

  it("fills skipped ticks with the held state only", () => {
    const sampler = new LocalInputSampler(EDGE);
    sampler.sample([3 | EDGE, 99]);
    expect(sampler.held()).toEqual([3, 99]);
  });
});

/** A counter simulation: state = sum of inputs. */
function counterSim(): LockstepSimulation & { total: number; steps: number[] } {
  const sim = {
    total: 0,
    steps: [] as number[],
    step(tick: number, inputs: readonly (number | readonly number[])[]) {
      sim.steps.push(tick);
      for (const i of inputs)
        sim.total += typeof i === "number" ? i : (i[0] ?? 0);
    },
    hash: () => sim.total,
    snapshot: () => JSON.stringify({ total: sim.total }),
    restore: (_tick: number, data: string) => {
      sim.total = (JSON.parse(data) as { total: number }).total;
    },
  };
  return sim;
}

const MATCH: MatchStart = {
  matchId: "m",
  seed: 1,
  mode: "dogfight",
  options: {},
  inputDelay: 2,
  authoritySeat: 0,
  seats: [
    {
      seat: 0,
      playerId: "a",
      name: "A",
      team: 0,
      loadout: { faction: "f", ships: ["s"] },
    },
    {
      seat: 1,
      playerId: "b",
      name: "B",
      team: 1,
      loadout: { faction: "f", ships: ["s"] },
    },
  ],
};

function session(localSeat = 0) {
  const clock = new VirtualScheduler();
  const sent: ClientMessage[] = [];
  const s = new LockstepSession({
    match: MATCH,
    localSeat,
    outbox: { send: (m) => sent.push(m) },
    clock,
    hashIntervalTicks: 4,
  });
  s.receive({ t: "go", serverTime: 0 });
  return { s, sent, clock, sim: counterSim() };
}

describe("AdaptiveDelay", () => {
  const frame = TICK_MS;

  it("raises the delay on repeated short stalls (the delay is shorter than the path)", () => {
    const adaptive = new AdaptiveDelay(3, 3);
    for (let i = 0; i < 12; i++) {
      adaptive.observe(frame, true);
      adaptive.observe(frame, false);
      adaptive.observe(frame, false);
    }
    expect(adaptive.delay).toBeGreaterThan(3);
  });

  it("ignores one long stall (a TCP retransmit no delay would hide)", () => {
    const adaptive = new AdaptiveDelay(3, 3);
    for (let i = 0; i < 15; i++) adaptive.observe(frame, true);
    adaptive.observe(frame, false);
    expect(adaptive.delay).toBe(3);
  });

  it("steps back down after a calm spell, never below the match's delay", () => {
    const adaptive = new AdaptiveDelay(5, 3);
    for (let ms = 0; ms < 30_000; ms += frame) adaptive.observe(frame, false);
    expect(adaptive.delay).toBe(3);
  });
});

describe("LockstepSession", () => {
  it("does nothing until the relay says go", () => {
    const clock = new VirtualScheduler();
    const s = new LockstepSession({
      match: MATCH,
      localSeat: 0,
      outbox: { send: () => undefined },
      clock,
    });
    expect(s.update(100, counterSim()).ticksRun).toBe(0);
  });

  it("runs the neutral ticks before the input delay, then stalls without the remote input", () => {
    const { s, sim } = session();
    const result = s.update(TICK_MS * 4, sim);
    expect(sim.steps).toEqual([0, 1]);
    expect(result.stalled).toBe(true);
    expect(s.status).toBe("stalled");
  });

  it("schedules the local input inputDelay ticks ahead and sends it with the ack vector", () => {
    const { s, sent, sim } = session();
    s.sampleInput(7);
    s.update(TICK_MS, sim);
    expect(sent.at(-1)).toEqual({
      t: "in",
      from: 2,
      inputs: [7],
      at: 0,
      ack: [3, 2],
    });
  });

  it("simulates a tick once the remote input arrives", () => {
    const { s, sim } = session();
    s.sampleInput(1);
    s.update(TICK_MS * 3, sim);
    s.receive({ t: "in", seat: 1, from: 2, inputs: [10], at: 0, ack: 3 });
    s.update(TICK_MS, sim);
    expect(sim.steps).toContain(2);
    expect(sim.total).toBe(11);
  });

  it("reports a state hash every interval", () => {
    const { s, sent, sim } = session();
    s.receive({
      t: "in",
      seat: 1,
      from: 2,
      inputs: new Array(10).fill(0),
      at: 0,
      ack: 2,
    });
    s.update(TICK_MS * 8, sim);
    expect(
      sent
        .filter((m) => m.t === "hash")
        .map((m) => (m as { tick: number }).tick),
    ).toEqual([4]);
  });

  it("captures the requested snapshot when it is the authority", () => {
    const { s, sent, sim } = session(0);
    s.receive({ t: "snapshot_request", tick: 1 });
    s.update(TICK_MS * 2, sim);
    expect(sent.find((m) => m.t === "snapshot")).toMatchObject({ tick: 1 });
  });

  it("waits at a resync barrier, then jumps to the snapshot", () => {
    const { s, sim } = session(1);
    s.receive({ t: "resync", tick: 1, reason: "desync" });
    s.receive({
      t: "in",
      seat: 0,
      from: 2,
      inputs: new Array(10).fill(0),
      at: 0,
      ack: 2,
    });
    s.update(TICK_MS * 5, sim);
    expect(s.tick).toBe(1);
    expect(s.status).toBe("resyncing");
    s.receive({ t: "snapshot", tick: 1, data: JSON.stringify({ total: 42 }) });
    s.update(0, sim);
    expect(sim.total).toBe(42);
    expect(s.stats.snapshotsApplied).toBe(1);
  });

  it("resends un-acknowledged inputs until the relay acknowledges them", () => {
    const { s, sent, sim, clock } = session();
    s.sampleInput(3);
    s.update(TICK_MS, sim);
    clock.advance(200);
    s.update(0, sim);
    const ins = sent.filter((m) => m.t === "in");
    expect(ins).toHaveLength(2);
    s.receive({ t: "in", seat: 1, from: 2, inputs: [0], at: 0, ack: 4 });
    clock.advance(200);
    s.update(0, sim);
    expect(sent.filter((m) => m.t === "in")).toHaveLength(2);
  });
});
