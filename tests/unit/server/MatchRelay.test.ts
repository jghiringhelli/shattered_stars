import { describe, expect, it } from "vitest";
import {
  INPUT_AI_CONTROL,
  MAX_LEAD_TICKS,
  RESYNC_MARGIN_TICKS,
  type MatchStart,
  type ServerMessage,
} from "../../../src/net/protocol";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import {
  MATCH_OVER_GRACE_MS,
  MatchRelay,
} from "../../../server/src/MatchRelay";

const START: MatchStart = {
  matchId: "m1",
  seed: 42,
  mode: "dogfight",
  options: {},
  inputDelay: 0,
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

function harness(seats = START.seats) {
  const clock = new VirtualScheduler();
  const outbox: Array<{ seat: number; message: ServerMessage }> = [];
  const ended: Array<{ reason: string; winner: number | null }> = [];
  const relay = new MatchRelay(
    { ...START, seats },
    clock,
    { loadTimeoutMs: 30_000, reconnectWindowMs: 30_000 },
    {
      sendToSeat: (seat, message) => outbox.push({ seat, message }),
      onEnded: (reason, winner) => ended.push({ reason, winner }),
    },
  );
  const to = <T extends ServerMessage["t"]>(seat: number, type: T) =>
    outbox
      .filter((o) => o.seat === seat && o.message.t === type)
      .map((o) => o.message as Extract<ServerMessage, { t: T }>);
  const send = (
    seat: number,
    from: number,
    inputs: number[],
    ack: number[] = [0, 0],
    at = from,
  ) => relay.inputs(seat, { t: "in", from, inputs, at, ack });
  return { clock, outbox, ended, relay, to, send };
}

function running() {
  const h = harness();
  h.relay.loaded(0);
  h.relay.loaded(1);
  return h;
}

describe("MatchRelay start", () => {
  it("sends go once every seat loaded", () => {
    const h = harness();
    h.relay.loaded(0);
    expect(h.to(0, "go")).toHaveLength(0);
    h.relay.loaded(1);
    expect([h.to(0, "go").length, h.to(1, "go").length]).toEqual([1, 1]);
  });

  it("starts without a seat that never loads and lets the AI fly it", () => {
    const h = harness();
    h.relay.loaded(0);
    h.clock.advance(30_000);
    expect(h.relay.phase).toBe("running");
    h.send(0, 0, [5, 5]);
    expect(h.to(0, "in").at(-1)).toMatchObject({
      seat: 1,
      from: 0,
      inputs: [INPUT_AI_CONTROL, INPUT_AI_CONTROL],
    });
  });
});

describe("MatchRelay inputs", () => {
  it("expects each seat's stream to start at the match's input delay", () => {
    const clock = new VirtualScheduler();
    const outbox: ServerMessage[] = [];
    const relay = new MatchRelay(
      { ...START, inputDelay: 3 },
      clock,
      { loadTimeoutMs: 1, reconnectWindowMs: 1 },
      {
        sendToSeat: (_seat, message) => outbox.push(message),
        onEnded: () => undefined,
      },
    );
    relay.loaded(0);
    relay.loaded(1);
    relay.inputs(0, {
      t: "in",
      from: 0,
      inputs: [9, 9, 9, 1],
      at: 0,
      ack: [3, 3],
    });
    expect(outbox.filter((m) => m.t === "in")).toEqual([
      { t: "in", seat: 0, from: 3, inputs: [1], at: 0, ack: 3 },
    ]);
  });

  it("relays a seat's inputs to the others and never echoes them", () => {
    const h = running();
    h.send(0, 0, [1, 2, 3]);
    expect(h.to(1, "in")).toEqual([
      { t: "in", seat: 0, from: 0, inputs: [1, 2, 3], at: 0, ack: 0 },
    ]);
    expect(h.to(0, "in")).toHaveLength(0);
  });

  it("ignores duplicates and gaps and keeps only the fresh part of overlapping batches", () => {
    const h = running();
    h.send(0, 0, [1, 2]);
    h.send(0, 0, [1, 2]);
    h.send(0, 5, [9]);
    h.send(0, 1, [2, 3, 4]);
    expect(h.to(1, "in").map((m) => [m.from, m.inputs])).toEqual([
      [0, [1, 2]],
      [0, [1, 2, 3, 4]],
    ]);
  });

  it("resends everything the recipient has not acknowledged and trims what it has", () => {
    const h = running();
    h.send(0, 0, [1, 2]);
    h.send(1, 0, [7], [2, 0]);
    h.send(0, 2, [3]);
    expect(h.to(1, "in").at(-1)).toMatchObject({ from: 2, inputs: [3] });
  });

  it("tells each recipient the next tick the relay expects from it", () => {
    const h = running();
    h.send(1, 0, [7, 7]);
    h.send(0, 0, [1]);
    expect(h.to(1, "in").at(-1)?.ack).toBe(2);
  });

  it("drops batches that run too far ahead of the other seats", () => {
    const h = running();
    const far = MAX_LEAD_TICKS + 1;
    for (let from = 0; from <= far; from += 100)
      h.send(0, from, new Array(100).fill(0));
    expect(
      Math.max(...h.to(1, "in").map((m) => m.from + m.inputs.length)),
    ).toBeLessThanOrEqual(MAX_LEAD_TICKS + 1);
  });
});

describe("MatchRelay disconnects", () => {
  it("fills a disconnected seat with AI input so the other player never stalls", () => {
    const h = running();
    h.send(1, 0, [7]);
    h.relay.disconnect(1);
    expect(h.to(0, "peer").at(-1)).toMatchObject({
      seat: 1,
      status: "disconnected",
      graceMs: 30_000,
    });
    h.send(0, 0, [1, 1, 1, 1], [0, 1]);
    expect(h.to(0, "in").at(-1)).toMatchObject({
      seat: 1,
      from: 1,
      inputs: [INPUT_AI_CONTROL, INPUT_AI_CONTROL, INPUT_AI_CONTROL],
    });
  });

  it("hands authority to a present seat when the authority drops", () => {
    const h = running();
    h.relay.disconnect(0);
    expect(h.relay.authority).toBe(1);
    expect(h.to(1, "authority").at(-1)?.seat).toBe(1);
  });

  it("brings a reconnecting seat back through a snapshot and catches it up", () => {
    const h = running();
    h.send(0, 0, [1, 1]);
    h.relay.disconnect(1);
    h.send(0, 2, [1, 1]);
    h.relay.reconnect(1);
    h.relay.loaded(1);
    const barrier = h.to(1, "resync").at(-1)!;
    expect(barrier).toMatchObject({
      reason: "reconnect",
      tick: 4 + RESYNC_MARGIN_TICKS,
    });
    expect(h.to(0, "snapshot_request").at(-1)?.tick).toBe(barrier.tick);
    h.send(0, 4, new Array(barrier.tick).fill(2));
    h.relay.snapshot(0, barrier.tick, "{state}");
    expect(h.to(1, "snapshot").at(-1)).toEqual({
      t: "snapshot",
      tick: barrier.tick,
      data: "{state}",
    });
    const catchUp = h.to(1, "in").filter((m) => m.from === barrier.tick + 1);
    expect(catchUp.map((m) => m.seat).sort()).toEqual([0, 1]);
  });

  it("keeps the AI flying a seat that left and ends the match once everyone left", () => {
    const h = running();
    h.relay.leave(1);
    expect(h.to(0, "peer").at(-1)?.status).toBe("left");
    expect(h.ended).toHaveLength(0);
    h.relay.leave(0);
    expect(h.ended).toEqual([{ reason: "abandoned", winner: null }]);
  });
});

describe("MatchRelay desync detection", () => {
  it("accepts matching hashes silently", () => {
    const h = running();
    h.relay.hash(0, 30, 111);
    h.relay.hash(1, 30, 111);
    expect(h.relay.desyncCount).toBe(0);
    expect(h.to(1, "resync")).toHaveLength(0);
  });

  it("resyncs the non-authority seats from the authority's snapshot on a mismatch", () => {
    const h = running();
    h.send(0, 0, [0, 0, 0]);
    h.send(1, 0, [0, 0, 0]);
    h.relay.hash(0, 30, 111);
    h.relay.hash(1, 30, 222);
    expect(h.relay.desyncCount).toBe(1);
    const tick = h.to(1, "resync").at(-1)!.tick;
    expect(tick).toBe(3 + RESYNC_MARGIN_TICKS);
    expect(h.to(0, "resync")).toHaveLength(0);
    expect(h.to(0, "snapshot_request").at(-1)?.tick).toBe(tick);
    h.relay.snapshot(1, tick, "forged");
    h.relay.snapshot(0, tick - 1, "wrong tick");
    expect(h.to(1, "snapshot")).toHaveLength(0);
    h.relay.snapshot(0, tick, "good");
    expect(h.to(1, "snapshot").map((m) => m.data)).toEqual(["good"]);
  });

  it("ignores hashes from before the last resync barrier", () => {
    const h = running();
    h.relay.hash(0, 30, 1);
    h.relay.hash(1, 30, 2);
    const tick = h.relay.pendingResyncTick()!;
    h.relay.snapshot(0, tick, "s");
    h.relay.hash(0, 3, 5);
    h.relay.hash(1, 3, 6);
    expect(h.relay.desyncCount).toBe(1);
  });
});

describe("MatchRelay authority hand-off during a resync", () => {
  it("asks the new authority for the snapshot when the old one drops mid-resync", () => {
    const three = [
      ...START.seats,
      {
        seat: 2,
        playerId: "c",
        name: "C",
        team: 1 as const,
        loadout: { faction: "f", ships: ["s"] },
      },
    ];
    const h = harness(three);
    [0, 1, 2].forEach((seat) => h.relay.loaded(seat));
    h.relay.hash(0, 30, 1);
    h.relay.hash(1, 30, 2);
    h.relay.hash(2, 30, 2);
    expect(h.to(0, "snapshot_request")).toHaveLength(1);
    h.relay.disconnect(0);
    expect(h.relay.authority).toBe(1);
    const request = h.to(1, "snapshot_request").at(-1);
    expect(request).toBeDefined();
    h.relay.snapshot(1, request!.tick, "from new authority");
    expect(h.to(2, "snapshot").map((m) => m.data)).toEqual([
      "from new authority",
    ]);
  });
});

describe("MatchRelay match end", () => {
  it("ends with the authority's result once every seat reported", () => {
    const h = running();
    h.relay.matchOver(1, 0);
    h.relay.matchOver(0, 1);
    expect(h.ended).toEqual([{ reason: "finished", winner: 1 }]);
  });

  it("ends after a grace period when a seat never reports", () => {
    const h = running();
    h.relay.matchOver(1, 0);
    h.clock.advance(MATCH_OVER_GRACE_MS);
    expect(h.ended).toEqual([{ reason: "finished", winner: 0 }]);
  });
});
